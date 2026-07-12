alter table public.restaurants
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists location_address text,
  add column if not exists location_updated_at timestamptz;

alter table public.restaurants drop constraint if exists restaurants_latitude_check;
alter table public.restaurants add constraint restaurants_latitude_check
  check (latitude is null or latitude between -90 and 90);
alter table public.restaurants drop constraint if exists restaurants_longitude_check;
alter table public.restaurants add constraint restaurants_longitude_check
  check (longitude is null or longitude between -180 and 180);

alter table public.orders
  add column if not exists delivery_address text,
  add column if not exists delivery_latitude numeric(10,7),
  add column if not exists delivery_longitude numeric(10,7),
  add column if not exists restaurant_latitude numeric(10,7),
  add column if not exists restaurant_longitude numeric(10,7),
  add column if not exists delivery_distance_km numeric(10,2);

update public.orders
set delivery_address = address
where delivery_address is null and address is not null;

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'บ้าน',
  address text not null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_addresses_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint customer_addresses_longitude_check check (longitude is null or longitude between -180 and 180)
);

create index if not exists customer_addresses_user_idx on public.customer_addresses(user_id);
alter table public.customer_addresses enable row level security;

drop trigger if exists customer_addresses_touch_updated_at on public.customer_addresses;
create trigger customer_addresses_touch_updated_at before update on public.customer_addresses
for each row execute function public.touch_updated_at();

drop policy if exists "address owner or admin reads" on public.customer_addresses;
create policy "address owner or admin reads" on public.customer_addresses for select
using (user_id = public.current_profile_id() or public.is_admin());

drop policy if exists "address owner inserts" on public.customer_addresses;
create policy "address owner inserts" on public.customer_addresses for insert
with check (user_id = public.current_profile_id());

drop policy if exists "address owner updates" on public.customer_addresses;
create policy "address owner updates" on public.customer_addresses for update
using (user_id = public.current_profile_id())
with check (user_id = public.current_profile_id());

drop policy if exists "address owner deletes" on public.customer_addresses;
create policy "address owner deletes" on public.customer_addresses for delete
using (user_id = public.current_profile_id());

create or replace function public.haversine_distance_km(
  p_latitude_1 numeric,
  p_longitude_1 numeric,
  p_latitude_2 numeric,
  p_longitude_2 numeric
) returns numeric
language plpgsql immutable set search_path = public as $$
declare
  v_lat_delta double precision;
  v_lng_delta double precision;
  v_a double precision;
begin
  if p_latitude_1 is null or p_longitude_1 is null or p_latitude_2 is null or p_longitude_2 is null then
    return null;
  end if;

  v_lat_delta := radians((p_latitude_2 - p_latitude_1)::double precision);
  v_lng_delta := radians((p_longitude_2 - p_longitude_1)::double precision);
  v_a := power(sin(v_lat_delta / 2), 2)
    + cos(radians(p_latitude_1::double precision))
    * cos(radians(p_latitude_2::double precision))
    * power(sin(v_lng_delta / 2), 2);

  return round((6371 * 2 * atan2(sqrt(v_a), sqrt(1 - v_a)))::numeric, 2);
end;
$$;

create or replace function public.delivery_fee_for_distance(p_distance_km numeric)
returns numeric
language sql immutable set search_path = public as $$
  select case
    when p_distance_km is null or p_distance_km <= 3 then 20::numeric
    else 20 + ((ceil(p_distance_km) - 3) * 5)
  end;
$$;

create or replace function public.calculate_delivery_quote(
  p_restaurant_id uuid,
  p_delivery_latitude numeric default null,
  p_delivery_longitude numeric default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_restaurant record;
  v_distance numeric(10,2);
  v_fee numeric(10,2);
begin
  select latitude, longitude into v_restaurant
  from public.restaurants
  where id = p_restaurant_id
    and (status = 'approved' or owner_id = public.current_profile_id() or public.is_admin());

  if not found then
    raise exception 'restaurant is not available';
  end if;

  v_distance := public.haversine_distance_km(
    v_restaurant.latitude,
    v_restaurant.longitude,
    p_delivery_latitude,
    p_delivery_longitude
  );
  v_fee := public.delivery_fee_for_distance(v_distance);

  return jsonb_build_object(
    'distance_km', v_distance,
    'delivery_fee', v_fee,
    'restaurant_has_location', v_restaurant.latitude is not null and v_restaurant.longitude is not null,
    'uses_gps', v_distance is not null
  );
end;
$$;

drop function if exists public.create_order_with_gp(uuid,text,text,jsonb);
create function public.create_order_with_gp(
  p_restaurant_id uuid,
  p_delivery_address text,
  p_delivery_latitude numeric,
  p_delivery_longitude numeric,
  p_customer_note text,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_customer_id uuid;
  v_customer_name text;
  v_order_id uuid;
  v_food_total numeric(10,2) := 0;
  v_delivery_fee numeric(10,2) := 20;
  v_delivery_distance numeric(10,2);
  v_gp_percent numeric(5,2);
  v_restaurant_latitude numeric(10,7);
  v_restaurant_longitude numeric(10,7);
  v_item jsonb;
  v_menu record;
  v_quantity integer;
  v_note text;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if nullif(trim(p_delivery_address), '') is null then raise exception 'delivery address required'; end if;
  if (p_delivery_latitude is null) <> (p_delivery_longitude is null) then raise exception 'latitude and longitude must be provided together'; end if;
  if p_delivery_latitude is not null and not (p_delivery_latitude between -90 and 90) then raise exception 'invalid latitude'; end if;
  if p_delivery_longitude is not null and not (p_delivery_longitude between -180 and 180) then raise exception 'invalid longitude'; end if;

  select id, nullif(name, '') into v_customer_id, v_customer_name
  from public.profiles where auth_user_id = auth.uid() limit 1;
  if v_customer_id is null then raise exception 'profile not found'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'items required'; end if;

  select gp_percent, latitude, longitude
  into v_gp_percent, v_restaurant_latitude, v_restaurant_longitude
  from public.restaurants
  where id = p_restaurant_id and status = 'approved' and is_open = true;
  if v_gp_percent is null then raise exception 'restaurant is not available'; end if;

  v_delivery_distance := public.haversine_distance_km(
    v_restaurant_latitude, v_restaurant_longitude, p_delivery_latitude, p_delivery_longitude
  );
  v_delivery_fee := public.delivery_fee_for_distance(v_delivery_distance);

  create temporary table if not exists pg_temp.checkout_items (
    menu_item_id uuid, item_name text, unit_price numeric(10,2), quantity integer, note text
  ) on commit drop;
  truncate table pg_temp.checkout_items;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item->>'quantity')::integer, 0);
    v_note := nullif(v_item->>'note', '');
    if v_quantity <= 0 then raise exception 'quantity must be greater than zero'; end if;

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

  insert into public.orders(
    customer_id, restaurant_id, customer_name, food_total, delivery_fee, gp_percent,
    gp_amount, restaurant_net_income, grand_total, status, customer_note, address,
    delivery_address, delivery_latitude, delivery_longitude, restaurant_latitude,
    restaurant_longitude, delivery_distance_km
  ) values(
    v_customer_id, p_restaurant_id, coalesce(v_customer_name, 'ลูกค้า'), v_food_total, v_delivery_fee, v_gp_percent,
    round(v_food_total * v_gp_percent / 100, 2),
    round(v_food_total - (v_food_total * v_gp_percent / 100), 2),
    v_food_total + v_delivery_fee, 'pending', nullif(p_customer_note, ''), trim(p_delivery_address),
    trim(p_delivery_address), p_delivery_latitude, p_delivery_longitude, v_restaurant_latitude,
    v_restaurant_longitude, v_delivery_distance
  ) returning id into v_order_id;

  insert into public.order_items(order_id, menu_item_id, item_name, unit_price, quantity, note)
  select v_order_id, menu_item_id, item_name, unit_price, quantity, note from pg_temp.checkout_items;
  return v_order_id;
end;
$$;

grant select, insert, update, delete on public.customer_addresses to authenticated;
grant execute on function public.haversine_distance_km(numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.delivery_fee_for_distance(numeric) to authenticated;
grant execute on function public.calculate_delivery_quote(uuid,numeric,numeric) to authenticated;
grant execute on function public.create_order_with_gp(uuid,text,numeric,numeric,text,jsonb) to authenticated;
