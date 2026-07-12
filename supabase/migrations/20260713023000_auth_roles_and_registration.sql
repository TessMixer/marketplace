alter table public.profiles add column if not exists auth_user_id uuid unique;
update public.profiles set auth_user_id = id where auth_user_id is null;
alter table public.profiles alter column auth_user_id set not null;

create or replace function public.is_admin(check_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where auth_user_id = check_user and role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  requested_role public.user_role;
  profile_id uuid;
begin
  requested_role := case when new.raw_user_meta_data->>'role' = 'seller' then 'seller'::public.user_role else 'customer'::public.user_role end;

  insert into public.profiles (id, auth_user_id, name, email, phone, role)
  values (new.id, new.id, coalesce(new.raw_user_meta_data->>'name',''), new.email,
    new.raw_user_meta_data->>'phone', requested_role)
  on conflict (id) do update set auth_user_id=excluded.auth_user_id, name=excluded.name,
    email=excluded.email, phone=excluded.phone, role=excluded.role
  returning id into profile_id;

  if requested_role = 'seller' and nullif(new.raw_user_meta_data->>'restaurant_name','') is not null then
    insert into public.restaurants(owner_id, name, description, phone, address, open_time, close_time, status, gp_percent, is_open)
    values(profile_id, new.raw_user_meta_data->>'restaurant_name',
      coalesce(new.raw_user_meta_data->>'restaurant_description',''),
      new.raw_user_meta_data->>'restaurant_phone', new.raw_user_meta_data->>'restaurant_address',
      coalesce(nullif(new.raw_user_meta_data->>'open_time','')::time, '08:00'::time),
      coalesce(nullif(new.raw_user_meta_data->>'close_time','')::time, '20:00'::time),
      'pending', 15, false);
  end if;
  return new;
end; $$;

create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role is distinct from new.role
    and auth.uid() is not null
    and not public.is_admin(auth.uid()) then
    raise exception 'only admins can change user roles';
  end if;
  return new;
end; $$;
drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger before update on public.profiles
for each row execute procedure public.protect_profile_role();

drop policy if exists "profile owner readable" on public.profiles;
drop policy if exists "profile owner editable" on public.profiles;
create policy "profile owner or admin readable" on public.profiles for select
using (auth_user_id = auth.uid() or public.is_admin());
create policy "profile owner editable" on public.profiles for update
using (auth_user_id = auth.uid() or public.is_admin())
with check (auth_user_id = auth.uid() or public.is_admin());

drop policy if exists "approved restaurants readable" on public.restaurants;
create policy "approved owner or admin restaurants readable" on public.restaurants for select
using (status = 'approved' or owner_id in (select id from public.profiles where auth_user_id=auth.uid()) or public.is_admin());
create policy "seller creates own restaurant" on public.restaurants for insert
with check (owner_id in (select id from public.profiles where auth_user_id=auth.uid()) and exists(select 1 from public.profiles where id=owner_id and role='seller'));
drop policy if exists "seller manages own restaurant" on public.restaurants;
create policy "seller or admin manages restaurant" on public.restaurants for update
using (owner_id in (select id from public.profiles where auth_user_id=auth.uid()) or public.is_admin())
with check (owner_id in (select id from public.profiles where auth_user_id=auth.uid()) or public.is_admin());

drop policy if exists "seller manages own menu" on public.menu_items;
create policy "seller or admin manages menu" on public.menu_items for all
using (exists(select 1 from public.restaurants r join public.profiles p on p.id=r.owner_id where r.id=restaurant_id and p.auth_user_id=auth.uid()) or public.is_admin())
with check (exists(select 1 from public.restaurants r join public.profiles p on p.id=r.owner_id where r.id=restaurant_id and p.auth_user_id=auth.uid()) or public.is_admin());

drop policy if exists "seller reads restaurant orders" on public.orders;
drop policy if exists "seller updates restaurant orders" on public.orders;
create policy "order parties or admin read orders" on public.orders for select
using (customer_id in (select id from public.profiles where auth_user_id=auth.uid())
  or exists(select 1 from public.restaurants r join public.profiles p on p.id=r.owner_id where r.id=restaurant_id and p.auth_user_id=auth.uid())
  or public.is_admin());
create policy "seller or admin updates orders" on public.orders for update
using (exists(select 1 from public.restaurants r join public.profiles p on p.id=r.owner_id where r.id=restaurant_id and p.auth_user_id=auth.uid()) or public.is_admin());

drop policy if exists "order items visible to order parties" on public.order_items;
create policy "order items visible to parties or admin" on public.order_items for select
using (exists(select 1 from public.orders o left join public.restaurants r on r.id=o.restaurant_id left join public.profiles p on p.id=r.owner_id
  where o.id=order_id and (o.customer_id in (select id from public.profiles where auth_user_id=auth.uid()) or p.auth_user_id=auth.uid() or public.is_admin())));

create policy "admin manages categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manages gp settings" on public.gp_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "admin reads reports" on public.reports for select using (public.is_admin());
create policy "admin reads payments" on public.payments for select using (public.is_admin());

grant execute on function public.is_admin(uuid) to authenticated;
