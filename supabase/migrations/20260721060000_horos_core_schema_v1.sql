create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  gender text,
  preferred_language text not null default 'English'
    check (preferred_language in ('English', 'Hindi', 'Telugu')),
  current_city text,
  notification_time time without time zone not null default '06:00',
  notifications_enabled boolean not null default false,
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.birth_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  date_of_birth date not null,
  time_of_birth time without time zone not null,
  birth_place text not null check (char_length(birth_place) between 2 and 180),
  timezone text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  altitude_meters double precision not null default 0
    check (altitude_meters between -500 and 10000),
  rashi text,
  nakshatra text,
  lagna text,
  chart_json jsonb,
  calculation_profile text not null default 'south_indian_drik_lahiri_jpl_de440s_v1',
  calculation_mode text not null default 'provider'
    check (calculation_mode in ('provider', 'estimated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.horoscope_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period in ('daily', 'weekly', 'monthly', 'panchang')),
  period_key text not null,
  content_json jsonb not null,
  calculation_mode text not null default 'provider'
    check (calculation_mode in ('provider', 'estimated')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, period, period_key)
);

create index horoscope_cache_lookup_idx
  on public.horoscope_cache (user_id, period, period_key, expires_at);

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  platform text check (platform in ('android', 'ios')),
  product_id text,
  provider_customer_id text,
  status text not null default 'expired'
    check (status in ('trial', 'active', 'expired', 'cancelled')),
  trial_start_date timestamptz,
  trial_end_date timestamptz,
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  notification_time time without time zone not null default '06:00',
  timezone text not null default 'Asia/Kolkata',
  enabled boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create table public.app_settings (
  key text primary key,
  value_json jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.webhook_events (
  id text primary key,
  provider text not null,
  received_at timestamptz not null default now(),
  payload_json jsonb not null
);

create table public.trial_ledger (
  identifier_hash text primary key,
  first_trial_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger birth_details_set_updated_at
before update on public.birth_details
for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();
create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.birth_details enable row level security;
alter table public.horoscope_cache enable row level security;
alter table public.subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.app_settings enable row level security;
alter table public.webhook_events enable row level security;
alter table public.trial_ledger enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy profiles_delete_own on public.profiles
for delete to authenticated using ((select auth.uid()) = user_id);

create policy birth_details_select_own on public.birth_details
for select to authenticated using ((select auth.uid()) = user_id);
create policy birth_details_insert_own on public.birth_details
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy birth_details_update_own on public.birth_details
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy birth_details_delete_own on public.birth_details
for delete to authenticated using ((select auth.uid()) = user_id);

create policy horoscope_cache_select_own on public.horoscope_cache
for select to authenticated using ((select auth.uid()) = user_id);
create policy subscriptions_select_own on public.subscriptions
for select to authenticated using ((select auth.uid()) = user_id);

create policy notifications_select_own on public.notifications
for select to authenticated using ((select auth.uid()) = user_id);
create policy notifications_insert_own on public.notifications
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy notifications_update_own on public.notifications
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy notifications_delete_own on public.notifications
for delete to authenticated using ((select auth.uid()) = user_id);

comment on table public.trial_ledger is
  'One-way identifier hashes used only to prevent repeated free trials after account deletion.';
comment on column public.birth_details.chart_json is
  'Normalized consumer chart plus raw JPL-only Astro API provenance.';
