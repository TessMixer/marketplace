-- Harden access to sensitive order data and enable role-filtered Realtime.

create index if not exists restaurants_owner_id_idx on public.restaurants(owner_id);
create index if not exists menu_items_restaurant_id_idx on public.menu_items(restaurant_id);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_restaurant_id_idx on public.orders(restaurant_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

-- Profile owners may edit normal profile fields, but never their identity or role.
create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
    and not public.is_admin(auth.uid())
    and (
      old.id is distinct from new.id
      or old.auth_user_id is distinct from new.auth_user_id
      or old.role is distinct from new.role
    ) then
    raise exception 'only admins can change profile identity or role';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role_trigger on public.profiles;
drop trigger if exists protect_profile_security_fields_trigger on public.profiles;
create trigger protect_profile_security_fields_trigger
before update on public.profiles
for each row execute function public.protect_profile_security_fields();

drop policy if exists "profile owner readable" on public.profiles;
drop policy if exists "profile owner or admin readable" on public.profiles;
drop policy if exists "profile owner editable" on public.profiles;
create policy "profile owner or admin reads"
on public.profiles for select to authenticated
using (auth_user_id = auth.uid() or public.is_admin());
create policy "profile owner or admin updates"
on public.profiles for update to authenticated
using (auth_user_id = auth.uid() or public.is_admin())
with check (auth_user_id = auth.uid() or public.is_admin());

-- Orders are written only by security-definer RPCs. Direct table updates would
-- otherwise allow a seller to modify totals, GP or customer data.
drop policy if exists "customer reads own orders" on public.orders;
drop policy if exists "seller reads restaurant orders" on public.orders;
drop policy if exists "seller updates restaurant orders" on public.orders;
drop policy if exists "order parties or admin read orders" on public.orders;
drop policy if exists "seller or admin updates orders" on public.orders;
create policy "order parties or admin read"
on public.orders for select to authenticated
using (
  customer_id = public.current_profile_id()
  or exists (
    select 1
    from public.restaurants r
    where r.id = restaurant_id
      and r.owner_id = public.current_profile_id()
  )
  or public.is_admin()
);

drop policy if exists "order items visible to order parties" on public.order_items;
drop policy if exists "order items visible to parties or admin" on public.order_items;
create policy "order items visible to order parties or admin"
on public.order_items for select to authenticated
using (
  exists (
    select 1
    from public.orders o
    join public.restaurants r on r.id = o.restaurant_id
    where o.id = order_id
      and (
        o.customer_id = public.current_profile_id()
        or r.owner_id = public.current_profile_id()
        or public.is_admin()
      )
  )
);

revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;

revoke all on function public.protect_profile_security_fields() from public;
grant execute on function public.protect_profile_security_fields() to authenticated;

alter table public.orders replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'orders'
    ) then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
end;
$$;
