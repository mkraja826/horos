-- Non-mutating readiness probe for the Astro usage-metering schema only.

create or replace function public.api_usage_health_v1()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select jsonb_build_object(
        'ready',
            to_regclass('public.api_rate_limit_windows') is not null
            and to_regclass('public.api_usage_monthly') is not null
            and to_regclass('public.api_usage_events') is not null
            and to_regprocedure(
                'public.api_usage_admit_v1(text,uuid,text,integer,integer,bigint)'
            ) is not null
            and to_regprocedure(
                'public.api_usage_finalize_v1(text,integer)'
            ) is not null,
        'project_ref', 'hdaugtypjpniesdgyral',
        'schema_version', 'api_usage_metering_safety_v1'
    );
$$;

revoke all on function public.api_usage_health_v1()
    from public, anon, authenticated;

grant execute on function public.api_usage_health_v1()
    to service_role;

comment on function public.api_usage_health_v1() is
    'Non-mutating service-role readiness probe for the Astro API usage schema.';
;
