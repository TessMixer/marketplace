-- Admin-managed account lifecycle with audit history.
-- Seller onboarding stays immediate at the account level; the restaurant remains
-- pending and must be approved separately by an admin.

alter table public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists suspended_reason text,
  add column if not exists suspended_at timestamptz,
  add column if not exists status_updated_at timestamptz,
  add column if not exists status_updated_by uuid references public.profiles(id) on delete set null;

alter table public.profiles
  drop constraint if exists profiles_account_status_check;
alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'suspended', 'closed'));

create index if not exists profiles_account_status_idx
  on public.profiles(account_status);

create table if not exists public.admin_user_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  admin_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('active', 'suspended', 'closed')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists admin_user_actions_target_created_idx
  on public.admin_user_actions(target_user_id, created_at desc);

alter table public.admin_user_actions enable row level security;
drop policy if exists "admins read user action history" on public.admin_user_actions;
create policy "admins read user action history"
on public.admin_user_actions for select to authenticated
using (public.is_admin());

create or replace function public.is_account_active(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = check_user
      and account_status = 'active'
  );
$$;

-- Admin privileges are valid only while the admin account is active.
create or replace function public.is_admin(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = check_user
      and role = 'admin'
      and account_status = 'active'
  );
$$;

-- Returning no profile id makes ownership-based RPCs and policies fail closed.
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles
  where auth_user_id = auth.uid()
    and account_status = 'active'
  limit 1;
$$;

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
      or old.account_status is distinct from new.account_status
      or old.suspended_reason is distinct from new.suspended_reason
      or old.suspended_at is distinct from new.suspended_at
      or old.status_updated_at is distinct from new.status_updated_at
      or old.status_updated_by is distinct from new.status_updated_by
    ) then
    raise exception 'only admins can change profile security fields';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_active_account_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_account_active(auth.uid()) then
    raise exception 'account is not active';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'restaurants', 'menu_items', 'orders', 'order_items',
    'customer_addresses', 'payments'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists enforce_active_account_write_trigger on public.%I', table_name);
      execute format(
        'create trigger enforce_active_account_write_trigger before insert or update or delete on public.%I for each row execute function public.enforce_active_account_write()',
        table_name
      );
    end if;
  end loop;
end;
$$;

create or replace function public.admin_set_user_status(
  p_profile_id uuid,
  p_status text,
  p_reason text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_target_role public.user_role;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin permission required';
  end if;
  if p_status not in ('active', 'suspended', 'closed') then
    raise exception 'invalid account status';
  end if;
  if p_status in ('suspended', 'closed') and nullif(trim(p_reason), '') is null then
    raise exception 'reason required';
  end if;

  select id into v_admin_id
  from public.profiles
  where auth_user_id = auth.uid() and role = 'admin' and account_status = 'active';

  select role into v_target_role
  from public.profiles
  where id = p_profile_id
  for update;

  if v_target_role is null then raise exception 'profile not found'; end if;
  if p_profile_id = v_admin_id then raise exception 'cannot manage your own account'; end if;
  if v_target_role = 'admin' then raise exception 'admin accounts are protected'; end if;

  update public.profiles
  set account_status = p_status,
      suspended_reason = case when p_status = 'active' then null else trim(p_reason) end,
      suspended_at = case when p_status = 'active' then null else now() end,
      status_updated_at = now(),
      status_updated_by = v_admin_id
  where id = p_profile_id;

  -- A blocked seller must stop accepting orders immediately. Reactivation does
  -- not automatically approve or reopen the shop; an admin reviews it separately.
  if v_target_role = 'seller' and p_status <> 'active' then
    update public.restaurants
    set status = 'suspended', is_open = false
    where owner_id = p_profile_id;
  end if;

  insert into public.admin_user_actions(target_user_id, admin_user_id, action, reason)
  values(p_profile_id, v_admin_id, p_status, nullif(trim(p_reason), ''));

  return p_status;
end;
$$;

create or replace function public.admin_user_action_history(p_profile_id uuid)
returns table (
  id uuid,
  action text,
  reason text,
  created_at timestamptz,
  admin_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin permission required';
  end if;
  return query
  select a.id, a.action, a.reason, a.created_at, coalesce(p.name, 'ผู้ดูแลระบบ')
  from public.admin_user_actions a
  left join public.profiles p on p.id = a.admin_user_id
  where a.target_user_id = p_profile_id
  order by a.created_at desc;
end;
$$;

-- Suspended users may load their own profile to see the blocked-account message,
-- but sensitive order data is available only to active parties or active admins.
drop policy if exists "order parties or admin read" on public.orders;
create policy "order parties or admin read"
on public.orders for select to authenticated
using (
  public.is_account_active()
  and (
    customer_id = public.current_profile_id()
    or exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.owner_id = public.current_profile_id()
    )
    or public.is_admin()
  )
);

drop policy if exists "order items visible to order parties or admin" on public.order_items;
create policy "order items visible to order parties or admin"
on public.order_items for select to authenticated
using (
  public.is_account_active()
  and exists (
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

-- Storage writes also require an active seller account.
drop policy if exists "sellers upload own food images" on storage.objects;
drop policy if exists "sellers update own food images" on storage.objects;
drop policy if exists "sellers delete own food images" on storage.objects;

create policy "sellers upload own food images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'food-images'
  and (
    (
      (storage.foldername(name))[1] = auth.uid()::text
      and exists (
        select 1 from public.profiles
        where auth_user_id = auth.uid() and role = 'seller' and account_status = 'active'
      )
    )
    or public.is_admin()
  )
);

create policy "sellers update own food images"
on storage.objects for update to authenticated
using (
  bucket_id = 'food-images'
  and (((storage.foldername(name))[1] = auth.uid()::text and public.is_account_active()) or public.is_admin())
)
with check (
  bucket_id = 'food-images'
  and (((storage.foldername(name))[1] = auth.uid()::text and public.is_account_active()) or public.is_admin())
);

create policy "sellers delete own food images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'food-images'
  and (((storage.foldername(name))[1] = auth.uid()::text and public.is_account_active()) or public.is_admin())
);

revoke all on table public.admin_user_actions from anon, authenticated;
grant select on table public.admin_user_actions to authenticated;
revoke all on function public.is_account_active(uuid) from public;
revoke all on function public.enforce_active_account_write() from public;
revoke all on function public.admin_set_user_status(uuid,text,text) from public;
revoke all on function public.admin_user_action_history(uuid) from public;
grant execute on function public.is_account_active(uuid) to authenticated;
grant execute on function public.enforce_active_account_write() to authenticated;
grant execute on function public.admin_set_user_status(uuid,text,text) to authenticated;
grant execute on function public.admin_user_action_history(uuid) to authenticated;

alter table public.profiles replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profiles'
    ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end;
$$;
