create table public.auth_rate_limit_windows (
  scope_hash text not null,
  scope_kind text not null check (scope_kind in ('identifier', 'ip')),
  action text not null check (action in ('request', 'verify')),
  window_seconds integer not null check (window_seconds between 60 and 86400),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope_hash, action, window_seconds, window_start)
);

alter table public.auth_rate_limit_windows enable row level security;

create policy auth_rate_limit_windows_service_role_only
on public.auth_rate_limit_windows
for all
to service_role
using (true)
with check (true);

create index auth_rate_limit_windows_updated_at_idx
on public.auth_rate_limit_windows(updated_at);

create or replace function public.consume_horos_auth_limits_v1(
  p_identifier_hash text,
  p_ip_hash text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_rule record;
  v_window_start timestamptz;
  v_count integer;
  v_retry_after integer;
  v_max_retry_after integer := 0;
  v_blocked_by text;
begin
  if p_identifier_hash is null or p_identifier_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid auth identifier hash';
  end if;
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid auth IP hash';
  end if;
  if p_action not in ('request', 'verify') then
    raise exception 'Invalid auth rate-limit action';
  end if;

  for v_rule in
    select *
    from (
      values
        (
          p_identifier_hash,
          'identifier'::text,
          900,
          case when p_action = 'request' then 3 else 5 end,
          'identifier_15m'::text
        ),
        (
          p_identifier_hash,
          'identifier'::text,
          case when p_action = 'request' then 86400 else 3600 end,
          case when p_action = 'request' then 10 else 10 end,
          case when p_action = 'request' then 'identifier_24h' else 'identifier_1h' end
        ),
        (
          p_ip_hash,
          'ip'::text,
          900,
          case when p_action = 'request' then 10 else 20 end,
          'ip_15m'::text
        ),
        (
          p_ip_hash,
          'ip'::text,
          case when p_action = 'request' then 86400 else 3600 end,
          case when p_action = 'request' then 50 else 60 end,
          case when p_action = 'request' then 'ip_24h' else 'ip_1h' end
        )
    ) as rules(scope_hash, scope_kind, window_seconds, request_limit, reason)
  loop
    v_window_start := to_timestamp(
      floor(extract(epoch from v_now) / v_rule.window_seconds) * v_rule.window_seconds
    );

    insert into public.auth_rate_limit_windows(
      scope_hash,
      scope_kind,
      action,
      window_seconds,
      window_start,
      request_count,
      updated_at
    )
    values (
      v_rule.scope_hash,
      v_rule.scope_kind,
      p_action,
      v_rule.window_seconds,
      v_window_start,
      1,
      v_now
    )
    on conflict (scope_hash, action, window_seconds, window_start) do update
    set
      request_count = public.auth_rate_limit_windows.request_count + 1,
      updated_at = excluded.updated_at
    returning request_count into v_count;

    if v_count > v_rule.request_limit then
      v_retry_after := greatest(
        1,
        ceil(extract(epoch from (
          v_window_start + make_interval(secs => v_rule.window_seconds) - v_now
        )))::integer
      );
      if v_retry_after > v_max_retry_after then
        v_max_retry_after := v_retry_after;
        v_blocked_by := v_rule.reason;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'allowed', v_max_retry_after = 0,
    'retryAfterSeconds', v_max_retry_after,
    'blockedBy', v_blocked_by
  );
end;
$$;

create or replace function public.reset_horos_auth_verify_limits_v1(
  p_identifier_hash text,
  p_ip_hash text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_identifier_hash is null or p_identifier_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid auth identifier hash';
  end if;
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid auth IP hash';
  end if;

  delete from public.auth_rate_limit_windows
  where action = 'verify'
    and scope_hash in (p_identifier_hash, p_ip_hash);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on table public.auth_rate_limit_windows from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_rate_limit_windows to service_role;

revoke all on function public.consume_horos_auth_limits_v1(text, text, text)
from public, anon, authenticated;
grant execute on function public.consume_horos_auth_limits_v1(text, text, text)
to service_role;

revoke all on function public.reset_horos_auth_verify_limits_v1(text, text)
from public, anon, authenticated;
grant execute on function public.reset_horos_auth_verify_limits_v1(text, text)
to service_role;
