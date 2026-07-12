create extension if not exists "pgcrypto";

create type public.user_role as enum ('customer', 'seller', 'admin');
create type public.restaurant_status as enum ('pending', 'approved', 'suspended');
create type public.order_status as enum ('pending', 'accepted', 'preparing', 'ready', 'delivering', 'completed', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '', phone text, email text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  icon text, sort_order integer not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id) on delete set null,
  name text not null, description text not null default '', image_url text, address text, phone text,
  open_time time not null default '08:00', close_time time not null default '20:00',
  is_open boolean not null default true, status public.restaurant_status not null default 'pending',
  gp_percent numeric(5,2) not null default 15 check (gp_percent between 0 and 100),
  rating numeric(2,1) not null default 0, delivery_fee numeric(10,2) not null default 0,
  delivery_minutes text not null default '20-30 นาที', created_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null, name text not null,
  description text not null default '', price numeric(10,2) not null check (price >= 0), image_url text,
  is_available boolean not null default true, is_popular boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(), order_number bigint generated always as identity,
  customer_id uuid references public.profiles(id) on delete set null,
  restaurant_id uuid not null references public.restaurants(id), customer_name text not null default 'ลูกค้า',
  food_total numeric(10,2) not null, delivery_fee numeric(10,2) not null default 0,
  gp_percent numeric(5,2) not null, gp_amount numeric(10,2) not null,
  restaurant_net_income numeric(10,2) not null, grand_total numeric(10,2) not null,
  status public.order_status not null default 'pending', customer_note text, address text,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null, item_name text not null,
  unit_price numeric(10,2) not null, quantity integer not null check (quantity > 0), note text,
  created_at timestamptz not null default now()
);

create table public.gp_settings (
  id uuid primary key default gen_random_uuid(), default_gp_percent numeric(5,2) not null default 15,
  default_delivery_fee numeric(10,2) not null default 15, service_areas text[] not null default '{}',
  updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id) on delete cascade,
  amount numeric(10,2) not null, method text, status public.payment_status not null default 'pending',
  provider_reference text, created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(), report_type text not null, period_start date not null,
  period_end date not null, payload jsonb not null default '{}', generated_at timestamptz not null default now()
);

create index menu_items_restaurant_idx on public.menu_items(restaurant_id);
create index orders_restaurant_created_idx on public.orders(restaurant_id, created_at desc);
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index order_items_order_idx on public.order_items(order_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, phone, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''), new.email,
    new.raw_user_meta_data->>'phone', coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'customer'));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.create_marketplace_order(
  p_restaurant_id uuid, p_customer_name text, p_address text, p_note text, p_delivery_fee numeric,
  p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_order_id uuid; v_food_total numeric; v_gp numeric;
begin
  select coalesce(sum((x->>'price')::numeric * (x->>'quantity')::integer),0) into v_food_total
  from jsonb_array_elements(p_items) x;
  select gp_percent into v_gp from restaurants where id = p_restaurant_id and status = 'approved';
  if v_gp is null or v_food_total <= 0 then raise exception 'invalid order'; end if;
  insert into orders(customer_id, restaurant_id, customer_name, food_total, delivery_fee, gp_percent,
    gp_amount, restaurant_net_income, grand_total, customer_note, address)
  values(auth.uid(), p_restaurant_id, p_customer_name, v_food_total, p_delivery_fee, v_gp,
    round(v_food_total*v_gp/100,2), round(v_food_total-(v_food_total*v_gp/100),2),
    v_food_total+p_delivery_fee, p_note, p_address) returning id into v_order_id;
  insert into order_items(order_id, menu_item_id, item_name, unit_price, quantity, note)
  select v_order_id, nullif(x->>'menu_item_id','')::uuid, x->>'name', (x->>'price')::numeric,
    (x->>'quantity')::integer, x->>'note' from jsonb_array_elements(p_items) x;
  return v_order_id;
end; $$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.gp_settings enable row level security;
alter table public.payments enable row level security;
alter table public.reports enable row level security;

create policy "catalog categories readable" on public.categories for select using (is_active);
create policy "approved restaurants readable" on public.restaurants for select using (status = 'approved' or owner_id = auth.uid());
create policy "available menu readable" on public.menu_items for select using (is_available or exists(select 1 from restaurants r where r.id=restaurant_id and r.owner_id=auth.uid()));
create policy "profile owner readable" on public.profiles for select using (id = auth.uid());
create policy "profile owner editable" on public.profiles for update using (id = auth.uid());
create policy "customer reads own orders" on public.orders for select using (customer_id = auth.uid());
create policy "seller reads restaurant orders" on public.orders for select using (exists(select 1 from restaurants r where r.id=restaurant_id and r.owner_id=auth.uid()));
create policy "seller updates restaurant orders" on public.orders for update using (exists(select 1 from restaurants r where r.id=restaurant_id and r.owner_id=auth.uid()));
create policy "seller manages own menu" on public.menu_items for all using (exists(select 1 from restaurants r where r.id=restaurant_id and r.owner_id=auth.uid())) with check (exists(select 1 from restaurants r where r.id=restaurant_id and r.owner_id=auth.uid()));
create policy "seller manages own restaurant" on public.restaurants for update using (owner_id=auth.uid());
create policy "order items visible to order parties" on public.order_items for select using (exists(select 1 from orders o left join restaurants r on r.id=o.restaurant_id where o.id=order_id and (o.customer_id=auth.uid() or r.owner_id=auth.uid())));
grant execute on function public.create_marketplace_order(uuid,text,text,text,numeric,jsonb) to anon, authenticated;

insert into public.categories(name,icon,sort_order) values
('ข้าว','🍚',1),('เส้น','🍜',2),('เครื่องดื่ม','🧋',3),('ของหวาน','🍧',4),('ของทอด','🍗',5);
insert into public.gp_settings(default_gp_percent,default_delivery_fee,service_areas) values (15,15,array['กรุงเทพมหานคร','นนทบุรี']);

insert into public.restaurants(id,name,description,image_url,address,phone,is_open,status,gp_percent,rating,delivery_fee,delivery_minutes) values
('10000000-0000-0000-0000-000000000001','ครัวแม่อร','อาหารตามสั่งรสมือแม่ วัตถุดิบสดใหม่ทุกวัน','https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?auto=format&fit=crop&w=1000&q=80','สุขุมวิท 49 กรุงเทพฯ','081-234-5678',true,'approved',15,4.8,15,'20-30 นาที'),
('10000000-0000-0000-0000-000000000002','ก๋วยเตี๋ยวเรืออยุธยา','น้ำซุปเข้มข้น สูตรดั้งเดิม ชามต่อชาม','https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=1000&q=80','วัฒนา กรุงเทพฯ','082-345-6789',true,'approved',20,4.7,10,'15-25 นาที'),
('10000000-0000-0000-0000-000000000003','บ้านหวานละมุน','ขนมไทยและเครื่องดื่ม หวานน้อย อร่อยพอดี','https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=1000&q=80','คลองเตย กรุงเทพฯ','083-456-7890',true,'approved',15,4.9,20,'25-35 นาที');

insert into public.menu_items(id,restaurant_id,category_id,name,description,price,image_url,is_available,is_popular)
select v.id,v.restaurant_id,c.id,v.name,v.description,v.price,v.image_url,true,v.popular from (values
('20000000-0000-0000-0000-000000000001'::uuid,'10000000-0000-0000-0000-000000000001'::uuid,'ข้าว','ข้าวกะเพราหมูสับไข่ดาว','กะเพราหอม ๆ ผัดพริกแห้ง เลือกระดับความเผ็ดได้',75::numeric,'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=600&q=80',true),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','ข้าว','ข้าวผัดปู','เนื้อปูแน่น ข้าวร่วนหอมกระทะ',95,'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80',true),
('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','ข้าว','ต้มยำกุ้งน้ำข้น','กุ้งสด รสจัดจ้าน หอมสมุนไพร',145,'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?auto=format&fit=crop&w=600&q=80',false),
('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','เครื่องดื่ม','ชาไทยเย็น','ชาเข้ม หอมนม หวานกำลังดี',45,'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80',false),
('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','เส้น','ก๋วยเตี๋ยวเรือน้ำตก','เลือกเส้นและเนื้อสัตว์ได้',60,'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',true),
('20000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000003','ของหวาน','บัวลอยไข่หวาน','แป้งนุ่ม กะทิสด หอมควันเทียน',55,'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80',true)
) as v(id,restaurant_id,category_name,name,description,price,image_url,popular) join public.categories c on c.name=v.category_name;
