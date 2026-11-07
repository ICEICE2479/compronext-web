-- ==========================================================
-- ComproNext — PostgreSQL / Supabase Schema (MVP + Phase 2 Ready)
-- วิธีใช้: นำไปรันใน Supabase SQL Editor เพื่อสร้างตารางและ RLS
-- ==========================================================

create table if not exists public.products (
  id text primary key,
  name text not null,
  description text not null default '',
  image_url text,
  price integer not null check (price >= 0),
  currency text not null default 'THB',
  buy_url text not null,
  store_name text not null,
  platform text not null,
  category text not null,
  colors text[] not null default '{}',
  materials text[] not null default '{}',
  dimensions jsonb,
  ports text[] not null default '{}',
  specs jsonb not null default '{}'::jsonb,
  placement text not null default 'desk',
  status text not null default 'available' check (status in ('available', 'out_of_stock', 'broken_link')),
  price_updated_at date not null default current_date,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id text primary key,
  slug text unique not null,
  name text not null,
  description text not null default '',
  images text[] not null default '{}',
  style text not null check (style in ('gaming', 'work', 'health', 'creator', 'student', 'minimal')),
  colors text[] not null default '{}',
  materials text[] not null default '{}',
  lighting text[] not null default '{}',
  status text not null default 'published' check (status in ('draft', 'published', 'hidden')),
  featured boolean not null default false,
  popularity integer not null default 0,
  is_sample boolean not null default false,
  created_at date not null default current_date,
  updated_at date not null default current_date
);

-- ตารางเชื่อมห้องกับสินค้าด้วยรหัสสินค้า (ห้ามคัดลอกราคาสินค้ามาเก็บซ้ำ)
create table if not exists public.room_items (
  room_id text not null references public.rooms(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity >= 1),
  note text,
  primary key (room_id, product_id)
);

-- ตารางโปรไฟล์ผู้ใช้และสถานะ KYC (เก็บเฉพาะค่า Masked ห้ามเก็บเลขบัตรประชาชน 13 หลักดิบ)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  kyc_status text not null default 'unverified' check (kyc_status in ('unverified', 'verified_sandbox', 'verified_ndid')),
  national_id_masked text,
  creator_tier text not null default 'member',
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.rooms enable row level security;
alter table public.room_items enable row level security;

create policy "Public can read products" on public.products for select using (true);
create policy "Public can read published rooms" on public.rooms for select using (status = 'published');
create policy "Public can read room items" on public.room_items for select using (true);
