create extension if not exists pg_cron with schema pg_catalog;

create index if not exists horoscope_cache_expires_at_idx
  on public.horoscope_cache (expires_at);

create index if not exists api_usage_events_completed_admitted_idx
  on public.api_usage_events (admitted_at)
  where completed_at is not null;

create index if not exists webhook_events_processed_received_idx
  on public.webhook_events (received_at)
  where processed_at is not null;

create or replace function public.cleanup_horos_retention_v1(
  p_now timestamptz default now(),
  p_batch_limit integer default 10000
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_horoscope_cache integer := 0;
  v_auth_windows integer := 0;
  v_api_usage_events integer := 0;
  v_webhook_events integer := 0;
  v_cron_runs integer := 0;
begin
  if p_batch_limit < 1 or p_batch_limit > 50000 then
    raise exception 'p_batch_limit must be between 1 and 50000';
  end if;

  with candidates as (
    select id
    from public.horoscope_cache
    where expires_at < p_now - interval '7 days'
    order by expires_at
    limit p_batch_limit
    for update skip locked
  ), deleted as (
    delete from public.horoscope_cache target
    using candidates
    where target.id = candidates.id
    returning 1
  )
  select count(*)::integer into v_horoscope_cache from deleted;

  with candidates as (
    select scope_hash, action, window_seconds, window_start
    from public.auth_rate_limit_windows
    where updated_at < p_now - interval '2 days'
      and window_start + make_interval(secs => window_seconds) < p_now - interval '1 day'
    order by updated_at
    limit p_batch_limit
    for update skip locked
  ), deleted as (
    delete from public.auth_rate_limit_windows target
    using candidates
    where target.scope_hash = candidates.scope_hash
      and target.action = candidates.action
      and target.window_seconds = candidates.window_seconds
      and target.window_start = candidates.window_start
    returning 1
  )
  select count(*)::integer into v_auth_windows from deleted;

  with candidates as (
    select request_id
    from public.api_usage_events
    where completed_at is not null
      and admitted_at < p_now - interval '180 days'
    order by admitted_at
    limit p_batch_limit
    for update skip locked
  ), deleted as (
    delete from public.api_usage_events target
    using candidates
    where target.request_id = candidates.request_id
    returning 1
  )
  select count(*)::integer into v_api_usage_events from deleted;

  with candidates as (
    select id
    from public.webhook_events
    where processed_at is not null
      and received_at < p_now - interval '365 days'
    order by received_at
    limit p_batch_limit
    for update skip locked
  ), deleted as (
    delete from public.webhook_events target
    using candidates
    where target.id = candidates.id
    returning 1
  )
  select count(*)::integer into v_webhook_events from deleted;

  if to_regclass('cron.job_run_details') is not null then
    execute $cleanup$
      with candidates as (
        select runid
        from cron.job_run_details
        where end_time < $1 - interval '30 days'
        order by end_time
        limit $2
      ), deleted as (
        delete from cron.job_run_details target
        using candidates
        where target.runid = candidates.runid
        returning 1
      )
      select count(*)::integer from deleted
    $cleanup$
    into v_cron_runs
    using p_now, p_batch_limit;
  end if;

  return jsonb_build_object(
    'horoscopeCacheDeleted', v_horoscope_cache,
    'authWindowsDeleted', v_auth_windows,
    'apiUsageEventsDeleted', v_api_usage_events,
    'webhookEventsDeleted', v_webhook_events,
    'cronRunDetailsDeleted', v_cron_runs,
    'batchLimit', p_batch_limit,
    'retentionPolicy', jsonb_build_object(
      'horoscopeCacheGraceDays', 7,
      'authWindowRetentionDays', 2,
      'apiUsageRetentionDays', 180,
      'processedWebhookRetentionDays', 365,
      'cronRunHistoryDays', 30
    )
  );
end;
$$;

revoke all on function public.cleanup_horos_retention_v1(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_horos_retention_v1(timestamptz, integer)
  to service_role;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'horos-daily-retention-v1'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'horos-daily-retention-v1',
  '17 2 * * *',
  $cron$select public.cleanup_horos_retention_v1();$cron$
);
