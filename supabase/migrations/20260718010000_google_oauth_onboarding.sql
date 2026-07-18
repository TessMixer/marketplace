create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  requested_role public.user_role;
  profile_id uuid;
begin
  requested_role := case when new.raw_user_meta_data->>'role' = 'seller' then 'seller'::public.user_role else 'customer'::public.user_role end;

  insert into public.profiles (id, auth_user_id, name, email, phone, role)
  values (
    new.id,
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name',''), nullif(new.raw_user_meta_data->>'full_name',''), split_part(coalesce(new.email,''),'@',1)),
    new.email,
    new.raw_user_meta_data->>'phone',
    requested_role
  )
  on conflict (id) do update set
    auth_user_id=excluded.auth_user_id,
    name=excluded.name,
    email=excluded.email,
    phone=excluded.phone,
    role=excluded.role
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

create or replace function public.complete_google_onboarding(
  p_role text,
  p_name text,
  p_phone text,
  p_restaurant_name text default null,
  p_restaurant_description text default null,
  p_restaurant_phone text default null,
  p_restaurant_address text default null,
  p_open_time text default null,
  p_close_time text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles%rowtype;
  v_restaurant_id uuid;
  v_gp numeric(5,2) := 15;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_role not in ('customer','seller') then raise exception 'invalid onboarding role'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_phone),'') is null then
    raise exception 'name and phone are required';
  end if;

  select * into v_profile from public.profiles where auth_user_id = auth.uid() for update;
  if not found then raise exception 'profile not found'; end if;
  if v_profile.role = 'admin' then raise exception 'admin onboarding cannot be changed'; end if;

  update public.profiles
  set name=trim(p_name), phone=trim(p_phone), role=case when p_role='seller' then 'seller'::public.user_role else role end
  where id=v_profile.id;

  if p_role='seller' then
    if nullif(trim(p_restaurant_name),'') is null
      or nullif(trim(p_restaurant_description),'') is null
      or nullif(trim(p_restaurant_phone),'') is null
      or nullif(trim(p_restaurant_address),'') is null then
      raise exception 'restaurant information is required';
    end if;

    select id into v_restaurant_id from public.restaurants where owner_id=v_profile.id order by created_at limit 1;
    if v_restaurant_id is null then
      select coalesce(default_gp_percent,15) into v_gp from public.gp_settings order by updated_at desc limit 1;
      insert into public.restaurants(owner_id,name,description,phone,address,open_time,close_time,status,gp_percent,is_open)
      values(v_profile.id,trim(p_restaurant_name),trim(p_restaurant_description),trim(p_restaurant_phone),trim(p_restaurant_address),
        coalesce(nullif(p_open_time,'')::time,'08:00'::time),coalesce(nullif(p_close_time,'')::time,'20:00'::time),
        'pending',coalesce(v_gp,15),false)
      returning id into v_restaurant_id;
    end if;
  end if;

  return v_restaurant_id;
end; $$;

revoke all on function public.complete_google_onboarding(text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.complete_google_onboarding(text,text,text,text,text,text,text,text,text) to authenticated;
