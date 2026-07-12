alter type public.order_status add value if not exists 'rejected';

alter table public.restaurants add column if not exists updated_at timestamptz not null default now();
alter table public.menu_items add column if not exists is_deleted boolean not null default false;
alter table public.menu_items add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists restaurants_touch_updated_at on public.restaurants;
create trigger restaurants_touch_updated_at before update on public.restaurants
for each row execute function public.touch_updated_at();

drop trigger if exists menu_items_touch_updated_at on public.menu_items;
create trigger menu_items_touch_updated_at before update on public.menu_items
for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders
for each row execute function public.touch_updated_at();

create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.protect_restaurant_admin_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
    and not public.is_admin(auth.uid())
    and (old.status is distinct from new.status or old.gp_percent is distinct from new.gp_percent) then
    raise exception 'only admins can change restaurant status or GP';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_restaurant_admin_fields_trigger on public.restaurants;
create trigger protect_restaurant_admin_fields_trigger before update on public.restaurants
for each row execute function public.protect_restaurant_admin_fields();

create or replace function public.create_order_with_gp(
  p_restaurant_id uuid,
  p_delivery_address text,
  p_customer_note text,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_customer_id uuid;
  v_customer_name text;
  v_order_id uuid;
  v_food_total numeric(10,2) := 0;
  v_delivery_fee numeric(10,2);
  v_gp_percent numeric(5,2);
  v_item jsonb;
  v_menu record;
  v_quantity integer;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'login required';
  end if;

  select id, nullif(name, '') into v_customer_id, v_customer_name
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;

  if v_customer_id is null then
    raise exception 'profile not found';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items required';
  end if;

  select gp_percent, delivery_fee
  into v_gp_percent, v_delivery_fee
  from public.restaurants
  where id = p_restaurant_id
    and status = 'approved'
    and is_open = true;

  if v_gp_percent is null then
    raise exception 'restaurant is not available';
  end if;

  create temporary table if not exists pg_temp.checkout_items (
    menu_item_id uuid,
    item_name text,
    unit_price numeric(10,2),
    quantity integer,
    note text
  ) on commit drop;
  truncate table pg_temp.checkout_items;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item->>'quantity')::integer, 0);
    v_note := nullif(v_item->>'note', '');

    if v_quantity <= 0 then
      raise exception 'quantity must be greater than zero';
    end if;

    select id, name, price
    into v_menu
    from public.menu_items
    where id = (v_item->>'menu_item_id')::uuid
      and restaurant_id = p_restaurant_id
      and is_available = true
      and coalesce(is_deleted, false) = false;

    if v_menu.id is null then
      raise exception 'menu item is not available';
    end if;

    insert into pg_temp.checkout_items(menu_item_id, item_name, unit_price, quantity, note)
    values(v_menu.id, v_menu.name, v_menu.price, v_quantity, v_note);

    v_food_total := v_food_total + (v_menu.price * v_quantity);
  end loop;

  insert into public.orders(
    customer_id, restaurant_id, customer_name, food_total, delivery_fee, gp_percent,
    gp_amount, restaurant_net_income, grand_total, status, customer_note, address
  )
  values(
    v_customer_id, p_restaurant_id, coalesce(v_customer_name, 'ลูกค้า'), v_food_total, coalesce(v_delivery_fee, 0), v_gp_percent,
    round(v_food_total * v_gp_percent / 100, 2),
    round(v_food_total - (v_food_total * v_gp_percent / 100), 2),
    v_food_total + coalesce(v_delivery_fee, 0),
    'pending', nullif(p_customer_note, ''), nullif(p_delivery_address, '')
  )
  returning id into v_order_id;

  insert into public.order_items(order_id, menu_item_id, item_name, unit_price, quantity, note)
  select v_order_id, menu_item_id, item_name, unit_price, quantity, note
  from pg_temp.checkout_items;

  return v_order_id;
end;
$$;

create or replace function public.update_order_status(
  p_order_id uuid,
  p_status public.order_status
) returns public.order_status
language plpgsql security definer set search_path = public as $$
declare
  v_order record;
  v_is_seller boolean;
begin
  if auth.uid() is null then
    raise exception 'login required';
  end if;

  select o.status, r.owner_id
  into v_order
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  where o.id = p_order_id;

  if v_order.status is null then
    raise exception 'order not found';
  end if;

  v_is_seller := v_order.owner_id = public.current_profile_id();
  if not (v_is_seller or public.is_admin(auth.uid())) then
    raise exception 'permission denied';
  end if;

  if p_status = 'rejected' and v_order.status <> 'pending' then
    raise exception 'order can be rejected only while pending';
  end if;

  if p_status = 'accepted' and v_order.status <> 'pending' then
    raise exception 'invalid status transition';
  elsif p_status = 'preparing' and v_order.status <> 'accepted' then
    raise exception 'invalid status transition';
  elsif p_status = 'ready' and v_order.status <> 'preparing' then
    raise exception 'invalid status transition';
  elsif p_status = 'completed' and v_order.status <> 'ready' then
    raise exception 'invalid status transition';
  end if;

  update public.orders set status = p_status where id = p_order_id;
  return p_status;
end;
$$;

create or replace function public.seller_sales_summary(p_restaurant_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_restaurant_id uuid;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_result jsonb;
begin
  select id into v_restaurant_id
  from public.restaurants
  where id = coalesce(p_restaurant_id, id)
    and owner_id = public.current_profile_id()
  order by created_at
  limit 1;

  if v_restaurant_id is null and not public.is_admin(auth.uid()) then
    raise exception 'restaurant not found';
  end if;

  with completed_orders as (
    select *
    from public.orders
    where status = 'completed'
      and restaurant_id = coalesce(v_restaurant_id, p_restaurant_id)
  ),
  daily as (
    select to_char(d::date, 'YYYY-MM-DD') as label,
      coalesce(sum(o.food_total), 0) as food_total,
      coalesce(sum(o.gp_amount), 0) as gp_amount,
      coalesce(sum(o.restaurant_net_income), 0) as net_income
    from generate_series(v_today - interval '6 days', v_today, interval '1 day') d
    left join completed_orders o on (o.created_at at time zone 'Asia/Bangkok')::date = d::date
    group by d::date
    order by d::date
  )
  select jsonb_build_object(
    'today', jsonb_build_object(
      'orders', count(*) filter (where (created_at at time zone 'Asia/Bangkok')::date = v_today),
      'food_total', coalesce(sum(food_total) filter (where (created_at at time zone 'Asia/Bangkok')::date = v_today), 0),
      'gp_amount', coalesce(sum(gp_amount) filter (where (created_at at time zone 'Asia/Bangkok')::date = v_today), 0),
      'net_income', coalesce(sum(restaurant_net_income) filter (where (created_at at time zone 'Asia/Bangkok')::date = v_today), 0)
    ),
    'month', jsonb_build_object(
      'orders', count(*) filter (where date_trunc('month', created_at at time zone 'Asia/Bangkok') = date_trunc('month', now() at time zone 'Asia/Bangkok')),
      'food_total', coalesce(sum(food_total) filter (where date_trunc('month', created_at at time zone 'Asia/Bangkok') = date_trunc('month', now() at time zone 'Asia/Bangkok')), 0),
      'gp_amount', coalesce(sum(gp_amount) filter (where date_trunc('month', created_at at time zone 'Asia/Bangkok') = date_trunc('month', now() at time zone 'Asia/Bangkok')), 0),
      'net_income', coalesce(sum(restaurant_net_income) filter (where date_trunc('month', created_at at time zone 'Asia/Bangkok') = date_trunc('month', now() at time zone 'Asia/Bangkok')), 0)
    ),
    'last_7_days', (select jsonb_agg(to_jsonb(daily)) from daily)
  )
  into v_result
  from completed_orders;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.admin_sales_summary()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_result jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'permission denied';
  end if;

  with completed_orders as (
    select *
    from public.orders
    where status = 'completed'
  ),
  restaurant_counts as (
    select status, count(*) as total from public.restaurants group by status
  ),
  top_restaurants as (
    select r.id, r.name, coalesce(sum(o.food_total), 0) as food_total, count(o.id) as orders
    from public.restaurants r
    left join completed_orders o on o.restaurant_id = r.id
    group by r.id, r.name
    order by food_total desc
    limit 5
  ),
  top_menu_items as (
    select oi.item_name as name, coalesce(sum(oi.quantity), 0) as quantity, coalesce(sum(oi.quantity * oi.unit_price), 0) as food_total
    from public.order_items oi
    join completed_orders o on o.id = oi.order_id
    group by oi.item_name
    order by quantity desc
    limit 5
  )
  select jsonb_build_object(
    'today', jsonb_build_object(
      'orders', count(*) filter (where (created_at at time zone 'Asia/Bangkok')::date = v_today),
      'food_total', coalesce(sum(food_total) filter (where (created_at at time zone 'Asia/Bangkok')::date = v_today), 0),
      'gp_amount', coalesce(sum(gp_amount) filter (where (created_at at time zone 'Asia/Bangkok')::date = v_today), 0),
      'net_income', coalesce(sum(restaurant_net_income) filter (where (created_at at time zone 'Asia/Bangkok')::date = v_today), 0)
    ),
    'month', jsonb_build_object(
      'orders', count(*) filter (where date_trunc('month', created_at at time zone 'Asia/Bangkok') = date_trunc('month', now() at time zone 'Asia/Bangkok')),
      'food_total', coalesce(sum(food_total) filter (where date_trunc('month', created_at at time zone 'Asia/Bangkok') = date_trunc('month', now() at time zone 'Asia/Bangkok')), 0),
      'gp_amount', coalesce(sum(gp_amount) filter (where date_trunc('month', created_at at time zone 'Asia/Bangkok') = date_trunc('month', now() at time zone 'Asia/Bangkok')), 0),
      'net_income', coalesce(sum(restaurant_net_income) filter (where date_trunc('month', created_at at time zone 'Asia/Bangkok') = date_trunc('month', now() at time zone 'Asia/Bangkok')), 0)
    ),
    'restaurants', jsonb_build_object(
      'pending', coalesce((select total from restaurant_counts where status = 'pending'), 0),
      'approved', coalesce((select total from restaurant_counts where status = 'approved'), 0),
      'suspended', coalesce((select total from restaurant_counts where status = 'suspended'), 0)
    ),
    'top_restaurants', (select jsonb_agg(to_jsonb(top_restaurants)) from top_restaurants),
    'top_menu_items', (select jsonb_agg(to_jsonb(top_menu_items)) from top_menu_items)
  )
  into v_result
  from completed_orders;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

drop policy if exists "available menu readable" on public.menu_items;
create policy "menu readable by catalog parties" on public.menu_items for select
using (
  public.is_admin()
  or exists(select 1 from public.restaurants r join public.profiles p on p.id = r.owner_id where r.id = restaurant_id and p.auth_user_id = auth.uid())
  or (
    is_available = true
    and coalesce(is_deleted, false) = false
    and exists(select 1 from public.restaurants r where r.id = restaurant_id and r.status = 'approved' and r.is_open = true)
  )
);

drop policy if exists "seller or admin manages menu" on public.menu_items;
create policy "seller or admin manages menu" on public.menu_items for all
using (
  public.is_admin()
  or exists(select 1 from public.restaurants r join public.profiles p on p.id = r.owner_id where r.id = restaurant_id and p.auth_user_id = auth.uid())
)
with check (
  public.is_admin()
  or exists(select 1 from public.restaurants r join public.profiles p on p.id = r.owner_id where r.id = restaurant_id and p.auth_user_id = auth.uid())
);

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.create_order_with_gp(uuid,text,text,jsonb) to authenticated;
grant execute on function public.update_order_status(uuid,public.order_status) to authenticated;
grant execute on function public.seller_sales_summary(uuid) to authenticated;
grant execute on function public.admin_sales_summary() to authenticated;
