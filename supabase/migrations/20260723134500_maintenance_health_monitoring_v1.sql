create table if not exists public.maintenance_runs (
  id uuid primary key default gen_random_uuid(),
  task_name text not null,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result_json jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint maintenance_runs_task_name_check
    check (task_name ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  constraint maintenance_runs_status_check
    check (status in ('running', 'success', 'failed')),
  constraint maintenance_runs_completion_check
    check (
      (status = 'running' and completed_at is null)
      or (status in ('success', 'failed') and completed_at is not null)
    )
);

create table if not exists public.maintenance_alerts (
  alert_key text primary key,
  task_name text not null,
  severity text not null,
  status text not null,
  first_detected_at timestamptz not null,
  last_detected_at timestamptz not null,
  resolved_at timestamptz,
  details_json jsonb not null default '{}'::jsonb,
  constraint maintenance_alerts_key_check
    check (alert_key ~ '^[a-z0-9][a-z0-9_-]{2,95}$'),
  constraint maintenance_alerts_task_name_check
    check (task_name ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  constraint maintenance_alerts_severity_check
    check (severity in ('warning', 'critical')),
  constraint maintenance_alerts_status_check
    check (status in ('open', 'resolved')),
  constraint maintenance_alerts_resolution_check
    check (
      (status = 'open' and resolved_at is null)
      or (status = 'resolved' and resolved_at is not null)
    )
);

create index if not exists maintenance_runs_task_started_idx
  on public.maintenance_runs (task_name, started_at desc);

create index if not exists maintenance_runs_status_started_idx
  on public.maintenance_runs (status, started_at desc);

create index if not exists maintenance_alerts_status_severity_idx
  on public.maintenance_alerts (status, severity, last_detected_at desc);

alter table public.maintenance_runs enable row level security;
alter table public.maintenance_alerts enable row level security;

drop policy if exists maintenance_runs_service_only on public.maintenance_runs;
create policy maintenance_runs_service_only
  on public.maintenance_runs
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists maintenance_alerts_service_only on public.maintenance_alerts;
create policy maintenance_alerts_service_only
  on public.maintenance_alerts
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.maintenance_runs from public, anon, authenticated;
revoke all on table public.maintenance_alerts from public, anon, authenticated;
grant select on table public.maintenance_runs to service_role;
grant select on table public.maintenance_alerts to service_role;

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
  v_maintenance_runs integer := 0;
  v_maintenance_alerts integer := 0;
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

  with candidates as (
    select id
    from public.maintenance_runs
    where completed_at is not null
      and completed_at < p_now - interval '180 days'
    order by completed_at
    limit p_batch_limit
    for update skip locked
  ), deleted as (
    delete from public.maintenance_runs target
    using candidates
    where target.id = candidates.id
    returning 1
  )
  select count(*)::integer into v_maintenance_runs from deleted;

  with candidates as (
    select alert_key
    from public.maintenance_alerts
    where status = 'resolved'
      and resolved_at < p_now - interval '180 days'
    order by resolved_at
    limit p_batch_limit
    for update skip locked
  ), deleted as (
    delete from public.maintenance_alerts target
    using candidates
    where target.alert_key = candidates.alert_key
    returning 1
  )
  select count(*)::integer into v_maintenance_alerts from deleted;

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
    'maintenanceRunsDeleted', v_maintenance_runs,
    'maintenanceAlertsDeleted', v_maintenance_alerts,
    'cronRunDetailsDeleted', v_cron_runs,
    'batchLimit', p_batch_limit,
    'retentionPolicy', jsonb_build_object(
      'horoscopeCacheGraceDays', 7,
      'authWindowRetentionDays', 2,
      'apiUsageRetentionDays', 180,
      'processedWebhookRetentionDays', 365,
      'maintenanceHistoryDays', 180,
      'cronRunHistoryDays', 30
    )
  );
end;
$$;

create or replace function public.refresh_horos_maintenance_alerts_v1(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_retention_job_active boolean := false;
  v_watchdog_job_active boolean := false;
  v_last_status text;
  v_last_started_at timestamptz;
  v_last_completed_at timestamptz;
  v_last_result jsonb;
  v_last_success_at timestamptz;
  v_missed boolean;
  v_failed boolean;
  v_backlog boolean := false;
  v_batch_limit integer := 10000;
  v_open_alerts integer := 0;
begin
  select coalesce(bool_or(active), false)
    into v_retention_job_active
  from cron.job
  where jobname = 'horos-daily-retention-v1';

  select coalesce(bool_or(active), false)
    into v_watchdog_job_active
  from cron.job
  where jobname = 'horos-maintenance-watchdog-v1';

  select status, started_at, completed_at, result_json
    into v_last_status, v_last_started_at, v_last_completed_at, v_last_result
  from public.maintenance_runs
  where task_name = 'retention_cleanup'
  order by started_at desc
  limit 1;

  select max(completed_at)
    into v_last_success_at
  from public.maintenance_runs
  where task_name = 'retention_cleanup'
    and status = 'success';

  v_missed := v_last_started_at is null or v_last_started_at < p_now - interval '30 hours';
  v_failed := v_last_status = 'failed';

  if v_last_result is not null then
    v_batch_limit := greatest(1, coalesce((v_last_result ->> 'batchLimit')::integer, 10000));
    v_backlog :=
      coalesce((v_last_result ->> 'horoscopeCacheDeleted')::integer, 0) >= v_batch_limit
      or coalesce((v_last_result ->> 'authWindowsDeleted')::integer, 0) >= v_batch_limit
      or coalesce((v_last_result ->> 'apiUsageEventsDeleted')::integer, 0) >= v_batch_limit
      or coalesce((v_last_result ->> 'webhookEventsDeleted')::integer, 0) >= v_batch_limit
      or coalesce((v_last_result ->> 'maintenanceRunsDeleted')::integer, 0) >= v_batch_limit
      or coalesce((v_last_result ->> 'maintenanceAlertsDeleted')::integer, 0) >= v_batch_limit;
  end if;

  if not v_retention_job_active or not v_watchdog_job_active then
    insert into public.maintenance_alerts (
      alert_key, task_name, severity, status,
      first_detected_at, last_detected_at, resolved_at, details_json
    ) values (
      'maintenance_schedule_inactive', 'retention_cleanup', 'critical', 'open',
      p_now, p_now, null,
      jsonb_build_object(
        'retentionJobActive', v_retention_job_active,
        'watchdogJobActive', v_watchdog_job_active
      )
    )
    on conflict (alert_key) do update set
      severity = excluded.severity,
      status = 'open',
      last_detected_at = excluded.last_detected_at,
      resolved_at = null,
      details_json = excluded.details_json;
  else
    update public.maintenance_alerts
    set status = 'resolved', resolved_at = p_now, last_detected_at = p_now
    where alert_key = 'maintenance_schedule_inactive'
      and status = 'open';
  end if;

  if v_missed then
    insert into public.maintenance_alerts (
      alert_key, task_name, severity, status,
      first_detected_at, last_detected_at, resolved_at, details_json
    ) values (
      'retention_run_missed', 'retention_cleanup', 'critical', 'open',
      p_now, p_now, null,
      jsonb_build_object(
        'lastStartedAt', v_last_started_at,
        'expectedWithinHours', 30
      )
    )
    on conflict (alert_key) do update set
      severity = excluded.severity,
      status = 'open',
      last_detected_at = excluded.last_detected_at,
      resolved_at = null,
      details_json = excluded.details_json;
  else
    update public.maintenance_alerts
    set status = 'resolved', resolved_at = p_now, last_detected_at = p_now
    where alert_key = 'retention_run_missed'
      and status = 'open';
  end if;

  if v_failed then
    insert into public.maintenance_alerts (
      alert_key, task_name, severity, status,
      first_detected_at, last_detected_at, resolved_at, details_json
    ) values (
      'retention_run_failed', 'retention_cleanup', 'critical', 'open',
      p_now, p_now, null,
      jsonb_build_object(
        'lastStartedAt', v_last_started_at,
        'lastCompletedAt', v_last_completed_at,
        'lastStatus', v_last_status
      )
    )
    on conflict (alert_key) do update set
      severity = excluded.severity,
      status = 'open',
      last_detected_at = excluded.last_detected_at,
      resolved_at = null,
      details_json = excluded.details_json;
  else
    update public.maintenance_alerts
    set status = 'resolved', resolved_at = p_now, last_detected_at = p_now
    where alert_key = 'retention_run_failed'
      and status = 'open';
  end if;

  if v_backlog then
    insert into public.maintenance_alerts (
      alert_key, task_name, severity, status,
      first_detected_at, last_detected_at, resolved_at, details_json
    ) values (
      'retention_cleanup_backlog', 'retention_cleanup', 'warning', 'open',
      p_now, p_now, null,
      jsonb_build_object(
        'batchLimit', v_batch_limit,
        'lastResult', v_last_result
      )
    )
    on conflict (alert_key) do update set
      severity = excluded.severity,
      status = 'open',
      last_detected_at = excluded.last_detected_at,
      resolved_at = null,
      details_json = excluded.details_json;
  else
    update public.maintenance_alerts
    set status = 'resolved', resolved_at = p_now, last_detected_at = p_now
    where alert_key = 'retention_cleanup_backlog'
      and status = 'open';
  end if;

  select count(*)::integer
    into v_open_alerts
  from public.maintenance_alerts
  where status = 'open';

  return jsonb_build_object(
    'openAlerts', v_open_alerts,
    'retentionJobActive', v_retention_job_active,
    'watchdogJobActive', v_watchdog_job_active,
    'lastRunStatus', v_last_status,
    'lastRunStartedAt', v_last_started_at,
    'lastSuccessAt', v_last_success_at,
    'missed', v_missed,
    'backlog', v_backlog
  );
end;
$$;

create or replace function public.run_horos_retention_monitored_v1(
  p_now timestamptz default now(),
  p_batch_limit integer default 10000
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run_id uuid;
  v_result jsonb;
  v_error_code text;
  v_error_message text;
begin
  insert into public.maintenance_runs (
    task_name, status, started_at
  ) values (
    'retention_cleanup', 'running', clock_timestamp()
  )
  returning id into v_run_id;

  begin
    v_result := public.cleanup_horos_retention_v1(p_now, p_batch_limit);

    update public.maintenance_runs
    set status = 'success',
        completed_at = clock_timestamp(),
        result_json = v_result,
        error_code = null,
        error_message = null
    where id = v_run_id;

    perform public.refresh_horos_maintenance_alerts_v1(p_now);

    return jsonb_build_object(
      'runId', v_run_id,
      'status', 'success',
      'result', v_result
    );
  exception when others then
    get stacked diagnostics
      v_error_code = returned_sqlstate,
      v_error_message = message_text;

    update public.maintenance_runs
    set status = 'failed',
        completed_at = clock_timestamp(),
        result_json = null,
        error_code = left(v_error_code, 32),
        error_message = left(v_error_message, 1000)
    where id = v_run_id;

    perform public.refresh_horos_maintenance_alerts_v1(p_now);

    return jsonb_build_object(
      'runId', v_run_id,
      'status', 'failed',
      'errorCode', left(v_error_code, 32),
      'errorMessage', left(v_error_message, 1000)
    );
  end;
end;
$$;

create or replace function public.get_horos_maintenance_health_v1(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refresh jsonb;
  v_last_run jsonb;
  v_last_success jsonb;
  v_alerts jsonb;
  v_critical integer := 0;
  v_warning integer := 0;
  v_status text;
begin
  v_refresh := public.refresh_horos_maintenance_alerts_v1(p_now);

  select to_jsonb(run_row)
    into v_last_run
  from (
    select id, task_name, status, started_at, completed_at,
           result_json, error_code, error_message
    from public.maintenance_runs
    where task_name = 'retention_cleanup'
    order by started_at desc
    limit 1
  ) run_row;

  select to_jsonb(success_row)
    into v_last_success
  from (
    select id, task_name, status, started_at, completed_at, result_json
    from public.maintenance_runs
    where task_name = 'retention_cleanup'
      and status = 'success'
    order by completed_at desc
    limit 1
  ) success_row;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'key', alert_key,
        'task', task_name,
        'severity', severity,
        'firstDetectedAt', first_detected_at,
        'lastDetectedAt', last_detected_at,
        'details', details_json
      ) order by severity, last_detected_at desc
    ), '[]'::jsonb),
    count(*) filter (where severity = 'critical')::integer,
    count(*) filter (where severity = 'warning')::integer
  into v_alerts, v_critical, v_warning
  from public.maintenance_alerts
  where status = 'open';

  v_status := case
    when v_critical > 0 then 'unhealthy'
    when v_warning > 0 then 'degraded'
    else 'healthy'
  end;

  return jsonb_build_object(
    'status', v_status,
    'checkedAt', p_now,
    'scheduler', jsonb_build_object(
      'retentionJobActive', coalesce((v_refresh ->> 'retentionJobActive')::boolean, false),
      'watchdogJobActive', coalesce((v_refresh ->> 'watchdogJobActive')::boolean, false),
      'retentionSchedule', '17 2 * * *',
      'watchdogSchedule', '27 * * * *'
    ),
    'lastRun', v_last_run,
    'lastSuccess', v_last_success,
    'openAlertCount', v_critical + v_warning,
    'criticalAlertCount', v_critical,
    'warningAlertCount', v_warning,
    'alerts', v_alerts
  );
end;
$$;

revoke all on function public.cleanup_horos_retention_v1(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_horos_retention_v1(timestamptz, integer)
  to service_role;

revoke all on function public.refresh_horos_maintenance_alerts_v1(timestamptz)
  from public, anon, authenticated;
grant execute on function public.refresh_horos_maintenance_alerts_v1(timestamptz)
  to service_role;

revoke all on function public.run_horos_retention_monitored_v1(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.run_horos_retention_monitored_v1(timestamptz, integer)
  to service_role;

revoke all on function public.get_horos_maintenance_health_v1(timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_horos_maintenance_health_v1(timestamptz)
  to service_role;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname in (
      'horos-daily-retention-v1',
      'horos-maintenance-watchdog-v1'
    )
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'horos-daily-retention-v1',
  '17 2 * * *',
  $cron$select public.run_horos_retention_monitored_v1();$cron$
);

select cron.schedule(
  'horos-maintenance-watchdog-v1',
  '27 * * * *',
  $cron$select public.refresh_horos_maintenance_alerts_v1();$cron$
);
