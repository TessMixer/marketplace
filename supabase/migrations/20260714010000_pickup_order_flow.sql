-- เปลี่ยนระบบเป็นสั่งอาหารแบบรับที่ร้าน/ให้ร้านติดต่อกลับ โดยคงคอลัมน์ขนส่งเดิมไว้

drop function if exists public.update_order_status(uuid, public.order_status);

alter table public.orders alter column status drop default;
alter type public.order_status rename to order_status_with_delivery;
create type public.order_status as enum (
  'pending',
  'accepted',
  'preparing',
  'ready',
  'completed',
  'rejected',
  'cancelled'
);

alter table public.orders
  alter column status type public.order_status
  using (
    case
      when status::text in ('delivering', 'shipped', 'driver_assigned', 'out_for_delivery') then 'ready'
      else status::text
    end
  )::public.order_status;
alter table public.orders alter column status set default 'pending'::public.order_status;
drop type public.order_status_with_delivery;

alter table public.orders
  add column if not exists customer_phone text,
  add column if not exists fulfillment_method text not null default 'pickup';

alter table public.orders drop constraint if exists orders_fulfillment_method_check;
alter table public.orders add constraint orders_fulfillment_method_check
  check (fulfillment_method in ('pickup', 'shop_contact'));

update public.orders o
set customer_phone = p.phone
from public.profiles p
where o.customer_id = p.id and o.customer_phone is null;

-- ระบบใหม่ไม่มีค่าจัดส่ง แต่ออเดอร์เก่ายังคงยอดเดิมเพื่อรักษาประวัติ
alter table public.orders alter column delivery_fee set default 0;

drop function if exists public.create_order_with_gp(uuid,text,numeric,numeric,text,jsonb);
drop function if exists public.create_order_with_gp(uuid,text,text,jsonb);
drop function if exists public.create_order_with_gp(uuid,text,text,text,text,jsonb);
drop function if exists public.calculate_delivery_quote(uuid,numeric,numeric);
drop function if exists public.delivery_fee_for_distance(numeric);
drop function if exists public.haversine_distance_km(numeric,numeric,numeric,numeric);

create function public.create_order_with_gp(
  p_restaurant_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_fulfillment_method text,
  p_customer_note text,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_food_total numeric(10,2) := 0;
  v_gp_percent numeric(5,2);
  v_gp_amount numeric(10,2);
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

  select id into v_customer_id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
  if v_customer_id is null then raise exception 'profile not found'; end if;

  select gp_percent into v_gp_percent
  from public.restaurants
  where id = p_restaurant_id and status = 'approved' and is_open = true;
  if v_gp_percent is null then raise exception 'restaurant is not available'; end if;

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
    food_total, delivery_fee, gp_percent, gp_amount, restaurant_net_income,
    grand_total, status, customer_note, address,
    delivery_address, delivery_latitude, delivery_longitude, delivery_distance_km
  ) values(
    v_customer_id, p_restaurant_id, trim(p_customer_name), trim(p_customer_phone), p_fulfillment_method,
    v_food_total, 0, v_gp_percent, v_gp_amount, round(v_food_total - v_gp_amount, 2),
    v_food_total, 'pending', nullif(trim(p_customer_note), ''), null,
    null, null, null, null
  ) returning id into v_order_id;

  insert into public.order_items(order_id, menu_item_id, item_name, unit_price, quantity, note)
  select v_order_id, menu_item_id, item_name, unit_price, quantity, note
  from pg_temp.checkout_items;

  return v_order_id;
end;
$$;

create function public.update_order_status(
  p_order_id uuid,
  p_status public.order_status
) returns public.order_status
language plpgsql security definer set search_path = public as $$
declare
  v_order record;
  v_profile_id uuid;
  v_is_seller boolean;
  v_is_admin boolean;
  v_is_customer boolean;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  v_profile_id := public.current_profile_id();
  v_is_admin := public.is_admin(auth.uid());

  select o.status, o.customer_id, r.owner_id into v_order
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  where o.id = p_order_id;
  if v_order.status is null then raise exception 'order not found'; end if;

  v_is_seller := v_order.owner_id = v_profile_id;
  v_is_customer := v_order.customer_id = v_profile_id;

  if p_status = 'cancelled' then
    if not v_is_customer then raise exception 'permission denied'; end if;
    if v_order.status <> 'pending' then raise exception 'order can be cancelled only while pending'; end if;
  else
    if not (v_is_seller or v_is_admin) then raise exception 'permission denied'; end if;
    if p_status = 'rejected' and v_order.status <> 'pending' then
      raise exception 'order can be rejected only while pending';
    elsif p_status = 'accepted' and v_order.status <> 'pending' then
      raise exception 'invalid status transition';
    elsif p_status = 'preparing' and v_order.status <> 'accepted' then
      raise exception 'invalid status transition';
    elsif p_status = 'ready' and v_order.status <> 'preparing' then
      raise exception 'invalid status transition';
    elsif p_status = 'completed' and v_order.status <> 'ready' then
      raise exception 'invalid status transition';
    elsif p_status not in ('rejected', 'accepted', 'preparing', 'ready', 'completed') then
      raise exception 'invalid status transition';
    end if;
  end if;

  update public.orders set status = p_status where id = p_order_id;
  return p_status;
end;
$$;

grant execute on function public.create_order_with_gp(uuid,text,text,text,text,jsonb) to authenticated;
grant execute on function public.update_order_status(uuid,public.order_status) to authenticated;
