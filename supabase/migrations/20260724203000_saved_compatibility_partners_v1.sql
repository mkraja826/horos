create extension if not exists pgcrypto;

create table if not exists public.saved_compatibility_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  date_of_birth date not null,
  time_of_birth time without time zone not null,
  timezone text not null check (char_length(timezone) between 1 and 64),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  altitude_meters double precision not null default 0
    check (altitude_meters between -500 and 10000),
  consent_recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_compatibility_partners_user_created_idx
  on public.saved_compatibility_partners (user_id, created_at desc);

alter table public.saved_compatibility_partners enable row level security;

revoke all on table public.saved_compatibility_partners from public, anon, authenticated;
grant select, insert, update, delete on table public.saved_compatibility_partners to service_role;

comment on table public.saved_compatibility_partners is
  'Optional secondary birth profiles stored only after explicit user consent. Labels are never forwarded to Astro or Varahamihira.';
comment on column public.saved_compatibility_partners.consent_recorded_at is
  'Server-recorded time at which the authenticated user explicitly consented to persistence.';
