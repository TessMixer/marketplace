-- Allow trusted SQL/service contexts to bootstrap the first admin while still
-- preventing authenticated users from promoting themselves through the API.
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
