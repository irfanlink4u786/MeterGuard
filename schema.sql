-- Run in the Supabase SQL Editor of the NEW dedicated project.
-- All site and reading access requires an explicitly provisioned profile.
create extension if not exists pgcrypto;
create table public.meter_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null,
 role text not null check (role in ('admin','supervisor')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.meter_sites (
 id uuid primary key default gen_random_uuid(),
 site_code text not null unique,
 site_name text,
 grid text,
 monthly_limit numeric(14,2) not null check (monthly_limit > 0),
 theft_disconnected_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.meter_site_assignments (
 user_id uuid not null references public.meter_profiles(user_id) on delete cascade,
 site_id uuid not null references public.meter_sites(id) on delete cascade,
 primary key(user_id,site_id)
);
create table public.meter_readings (
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null references public.meter_sites(id),
 reading_at timestamptz not null,
 peak numeric(16,2) not null check (peak>=0),
 off_peak numeric(16,2) not null check (off_peak>=0),
 photo_path text not null,
 connection_status text not null check (connection_status in ('disconnected','suspected','connected','unknown')),
 notes text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index meter_readings_site_date on public.meter_readings(site_id,reading_at);
create index meter_assignments_user on public.meter_site_assignments(user_id);
create or replace function public.meter_is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.meter_profiles where user_id=(select auth.uid()) and active and role='admin');
$$;
create or replace function public.meter_can_access(p_site uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.meter_profiles p where p.user_id=(select auth.uid()) and p.active and (p.role='admin' or exists(select 1 from public.meter_site_assignments a where a.user_id=p.user_id and a.site_id=p_site)));
$$;
revoke all on function public.meter_is_admin() from public;
revoke all on function public.meter_can_access(uuid) from public;
grant execute on function public.meter_is_admin() to authenticated;
grant execute on function public.meter_can_access(uuid) to authenticated;
alter table public.meter_profiles enable row level security;
alter table public.meter_sites enable row level security;
alter table public.meter_site_assignments enable row level security;
alter table public.meter_readings enable row level security;
create policy "profile self or admin" on public.meter_profiles for select to authenticated using (user_id=(select auth.uid()) or (select public.meter_is_admin()));
create policy "admin manage profiles" on public.meter_profiles for all to authenticated using ((select public.meter_is_admin())) with check ((select public.meter_is_admin()));
create policy "read assigned sites" on public.meter_sites for select to authenticated using ((select public.meter_can_access(id)));
create policy "admin manage sites" on public.meter_sites for all to authenticated using ((select public.meter_is_admin())) with check ((select public.meter_is_admin()));
create policy "read own assignments" on public.meter_site_assignments for select to authenticated using (user_id=(select auth.uid()) or (select public.meter_is_admin()));
create policy "admin manage assignments" on public.meter_site_assignments for all to authenticated using ((select public.meter_is_admin())) with check ((select public.meter_is_admin()));
create policy "read assigned meter records" on public.meter_readings for select to authenticated using ((select public.meter_can_access(site_id)));
create policy "submit assigned meter records" on public.meter_readings for insert to authenticated with check (created_by=(select auth.uid()) and (select public.meter_can_access(site_id)) and reading_at <= now()+interval '5 minutes');
-- Immutable evidence: no UPDATE or DELETE policies for readings.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('meter-evidence','meter-evidence',false,8388608,array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;
create policy "upload own meter evidence" on storage.objects for insert to authenticated
with check (bucket_id='meter-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.meter_profiles p where p.user_id=(select auth.uid()) and p.active));
create policy "view authorized evidence" on storage.objects for select to authenticated
using (bucket_id='meter-evidence' and (select public.meter_is_admin() or exists (
 select 1 from public.meter_readings r where r.photo_path=name and (select public.meter_can_access(r.site_id))
 )));
-- Evidence cannot be overwritten or deleted by field users.
-- Provision admin after creating an Auth user (replace UUID with actual auth.users.id):
-- insert into public.meter_profiles(user_id,full_name,role) values ('USER_UUID','Administrator','admin');
-- Provision supervisors, then assign sites in meter_site_assignments.
-- Site criteria import example:
-- insert into public.meter_sites(site_code,site_name,grid,monthly_limit) values ('4130','Example Site','C1001',3420);
