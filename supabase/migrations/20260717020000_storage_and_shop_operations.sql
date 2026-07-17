-- Image storage and practical shop-operation controls.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'food-images',
  'food-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "food images public read" on storage.objects;
drop policy if exists "sellers upload own food images" on storage.objects;
drop policy if exists "sellers update own food images" on storage.objects;
drop policy if exists "sellers delete own food images" on storage.objects;

create policy "food images public read"
on storage.objects for select
using (bucket_id = 'food-images');

create policy "sellers upload own food images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'food-images'
  and (
    (
      (storage.foldername(name))[1] = auth.uid()::text
      and exists (select 1 from public.profiles where auth_user_id = auth.uid() and role = 'seller')
    )
    or public.is_admin()
  )
);

create policy "sellers update own food images"
on storage.objects for update to authenticated
using (
  bucket_id = 'food-images'
  and (((storage.foldername(name))[1] = auth.uid()::text and exists (select 1 from public.profiles where auth_user_id = auth.uid() and role = 'seller')) or public.is_admin())
)
with check (
  bucket_id = 'food-images'
  and (((storage.foldername(name))[1] = auth.uid()::text and exists (select 1 from public.profiles where auth_user_id = auth.uid() and role = 'seller')) or public.is_admin())
);

create policy "sellers delete own food images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'food-images'
  and (((storage.foldername(name))[1] = auth.uid()::text and exists (select 1 from public.profiles where auth_user_id = auth.uid() and role = 'seller')) or public.is_admin())
);

alter table public.restaurants
  add column if not exists max_active_orders integer not null default 20;
alter table public.restaurants
  drop constraint if exists restaurants_max_active_orders_check;
alter table public.restaurants
  add constraint restaurants_max_active_orders_check
  check (max_active_orders between 1 and 100);

alter table public.orders
  add column if not exists requested_pickup_time timestamptz;

create or replace function public.restaurant_accepting_orders(
  p_is_open boolean,
  p_open_time time,
  p_close_time time
) returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(p_is_open, false) and case
    when p_open_time = p_close_time then true
    when p_open_time < p_close_time then
      (now() at time zone 'Asia/Bangkok')::time >= p_open_time
      and (now() at time zone 'Asia/Bangkok')::time < p_close_time
    else
      (now() at time zone 'Asia/Bangkok')::time >= p_open_time
      or (now() at time zone 'Asia/Bangkok')::time < p_close_time
  end;
$$;

drop function if exists public.create_order_with_gp(uuid,text,text,text,text,jsonb);
drop function if exists public.create_order_with_gp(uuid,text,text,text,text,timestamptz,jsonb);

create function public.create_order_with_gp(
  p_restaurant_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_fulfillment_method text,
  p_customer_note text,
  p_requested_pickup_time timestamptz,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_food_total numeric(10,2) := 0;
  v_gp_percent numeric(5,2);
  v_gp_amount numeric(10,2);
  v_max_active_orders integer;
  v_active_orders integer;
  v_is_open boolean;
  v_open_time time;
  v_close_time time;
  v_item jsonb;
  v_menu record;
  v_quantity integer;
  v_note text;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if nullif(trim(p_customer_name), '') is null then raise exception 'customer name required'; end if;
  if nullif(trim(p_customer_phone), '') is null then raise exception 'customer phone required'; end if;
  if p_fulfillment_method not in ('pickup', 'shop_contact') then raise exception 'invalid fulfillment method'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'items required'; end if;
  if p_requested_pickup_time is not null and p_requested_pickup_time < now() - interval '5 minutes' then
    raise exception 'pickup time is in the past';
  end if;
  if p_requested_pickup_time is not null and p_requested_pickup_time > now() + interval '7 days' then
    raise exception 'pickup time is too far ahead';
  end if;

  select id into v_customer_id
  from public.profiles
  where auth_user_id = auth.uid() and role = 'customer'
  limit 1;
  if v_customer_id is null then raise exception 'customer profile required'; end if;

  select gp_percent, max_active_orders, is_open, open_time, close_time
  into v_gp_percent, v_max_active_orders, v_is_open, v_open_time, v_close_time
  from public.restaurants
  where id = p_restaurant_id and status = 'approved'
  for update;

  if v_gp_percent is null then raise exception 'restaurant is not available'; end if;
  if not coalesce(public.restaurant_accepting_orders(v_is_open, v_open_time, v_close_time), false) then
    raise exception 'restaurant is outside opening hours';
  end if;

  select count(*) into v_active_orders
  from public.orders
  where restaurant_id = p_restaurant_id
    and status in ('pending', 'accepted', 'preparing', 'ready');
  if v_active_orders >= v_max_active_orders then raise exception 'restaurant has reached active order limit'; end if;

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
    begin
      v_quantity := (v_item->>'quantity')::integer;
    exception when others then
      raise exception 'invalid quantity';
    end;
    v_note := nullif(trim(v_item->>'note'), '');
    if v_quantity is null or v_quantity <= 0 then raise exception 'quantity must be greater than zero'; end if;

    select id, name, price into v_menu
    from public.menu_items
    where id = (v_item->>'menu_item_id')::uuid
      and restaurant_id = p_restaurant_id
      and is_available = true
      and coalesce(is_deleted, false) = false;
    if v_menu.id is null then raise exception 'menu item is not available'; end if;

    insert into pg_temp.checkout_items(menu_item_id, item_name, unit_price, quantity, note)
    values(v_menu.id, v_menu.name, v_menu.price, v_quantity, v_note);
    v_food_total := v_food_total + (v_menu.price * v_quantity);
  end loop;

  if v_food_total <= 0 then raise exception 'food total must be greater than zero'; end if;
  v_gp_amount := round(v_food_total * v_gp_percent / 100, 2);

  insert into public.orders(
    customer_id, restaurant_id, customer_name, customer_phone, fulfillment_method,
    requested_pickup_time, food_total, delivery_fee, gp_percent, gp_amount,
    restaurant_net_income, grand_total, status, customer_note, address,
    delivery_address, delivery_latitude, delivery_longitude, delivery_distance_km
  ) values(
    v_customer_id, p_restaurant_id, trim(p_customer_name), trim(p_customer_phone), p_fulfillment_method,
    p_requested_pickup_time, v_food_total, 0, v_gp_percent, v_gp_amount,
    round(v_food_total - v_gp_amount, 2), v_food_total, 'pending', nullif(trim(p_customer_note), ''), null,
    null, null, null, null
  ) returning id into v_order_id;

  insert into public.order_items(order_id, menu_item_id, item_name, unit_price, quantity, note)
  select v_order_id, menu_item_id, item_name, unit_price, quantity, note
  from pg_temp.checkout_items;

  return v_order_id;
end;
$$;

revoke all on function public.restaurant_accepting_orders(boolean,time,time) from public;
grant execute on function public.restaurant_accepting_orders(boolean,time,time) to authenticated;
revoke all on function public.create_order_with_gp(uuid,text,text,text,text,timestamptz,jsonb) from public;
grant execute on function public.create_order_with_gp(uuid,text,text,text,text,timestamptz,jsonb) to authenticated;
