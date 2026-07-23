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

    begin
      perform public.refresh_horos_maintenance_alerts_v1(p_now);
    exception when others then
      raise warning 'Maintenance alert refresh failed after successful retention run: %', sqlerrm;
    end;

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

    begin
      perform public.refresh_horos_maintenance_alerts_v1(p_now);
    exception when others then
      raise warning 'Maintenance alert refresh failed after failed retention run: %', sqlerrm;
    end;

    return jsonb_build_object(
      'runId', v_run_id,
      'status', 'failed',
      'errorCode', left(v_error_code, 32),
      'errorMessage', left(v_error_message, 1000)
    );
  end;
end;
$$;

revoke all on function public.run_horos_retention_monitored_v1(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.run_horos_retention_monitored_v1(timestamptz, integer)
  to service_role;
