create table if not exists public.api_rate_limit_windows (
    consumer_id uuid not null,
    window_start timestamptz not null,
    request_count integer not null default 0 check (request_count >= 0),
    updated_at timestamptz not null default now(),
    primary key (consumer_id, window_start)
);

create table if not exists public.api_usage_monthly (
    consumer_id uuid not null,
    month_start date not null,
    credits_used bigint not null default 0 check (credits_used >= 0),
    credits_reserved bigint not null default 0 check (credits_reserved >= 0),
    updated_at timestamptz not null default now(),
    primary key (consumer_id, month_start)
);

create table if not exists public.api_usage_events (
    request_id text primary key check (char_length(request_id) between 1 and 64),
    consumer_id uuid not null,
    route_key text not null check (char_length(route_key) between 1 and 256),
    credit_cost integer not null check (credit_cost > 0),
    admitted_at timestamptz not null default now(),
    completed_at timestamptz,
    response_status smallint check (response_status between 100 and 599),
    billable boolean,
    outcome text not null check (
        outcome in (
            'pending',
            'succeeded',
            'failed',
            'expired',
            'rejected_rate',
            'rejected_quota'
        )
    )
);

create index if not exists api_usage_events_consumer_admitted_idx
    on public.api_usage_events (consumer_id, admitted_at desc);

create index if not exists api_usage_events_outcome_admitted_idx
    on public.api_usage_events (outcome, admitted_at);

alter table public.api_rate_limit_windows enable row level security;
alter table public.api_usage_monthly enable row level security;
alter table public.api_usage_events enable row level security;

revoke all on public.api_rate_limit_windows from anon, authenticated;
revoke all on public.api_usage_monthly from anon, authenticated;
revoke all on public.api_usage_events from anon, authenticated;

grant all on public.api_rate_limit_windows to service_role;
grant all on public.api_usage_monthly to service_role;
grant all on public.api_usage_events to service_role;

create or replace function public.api_usage_admit_v1(
    p_request_id text,
    p_consumer_id uuid,
    p_route_key text,
    p_credit_cost integer,
    p_requests_per_minute integer,
    p_monthly_credit_limit bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_now timestamptz := clock_timestamp();
    v_window_start timestamptz := date_trunc('minute', v_now);
    v_month_start date := date_trunc('month', v_now)::date;
    v_request_count integer;
    v_remaining integer;
    v_retry_after integer := greatest(1, ceil(60 - extract(second from v_now))::integer);
    v_existing_outcome text;
    v_expired record;
begin
    if p_request_id is null or char_length(p_request_id) not between 1 and 64 then
        raise exception 'invalid request id';
    end if;
    if p_route_key is null or char_length(p_route_key) not between 1 and 256 then
        raise exception 'invalid route key';
    end if;
    if p_credit_cost <= 0 then
        raise exception 'credit cost must be positive';
    end if;
    if p_requests_per_minute <= 0 then
        raise exception 'requests per minute must be positive';
    end if;
    if p_monthly_credit_limit < 0 then
        raise exception 'monthly credit limit must not be negative';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_consumer_id::text, 0));

    select outcome
      into v_existing_outcome
      from public.api_usage_events
     where request_id = p_request_id;

    if found then
        select coalesce(request_count, 0)
          into v_request_count
          from public.api_rate_limit_windows
         where consumer_id = p_consumer_id
           and window_start = v_window_start;
        v_remaining := greatest(p_requests_per_minute - coalesce(v_request_count, 0), 0);
        return jsonb_build_object(
            'allowed', v_existing_outcome not in ('rejected_rate', 'rejected_quota'),
            'reason', case
                when v_existing_outcome = 'rejected_rate' then 'RATE_LIMIT_EXCEEDED'
                when v_existing_outcome = 'rejected_quota' then 'MONTHLY_QUOTA_EXCEEDED'
                else null
            end,
            'limit', p_requests_per_minute,
            'remaining', v_remaining,
            'retry_after_seconds', v_retry_after,
            'idempotent', true
        );
    end if;

    for v_expired in
        with expired as (
            update public.api_usage_events
               set outcome = 'expired',
                   completed_at = v_now,
                   billable = false
             where consumer_id = p_consumer_id
               and outcome = 'pending'
               and admitted_at < v_now - interval '10 minutes'
            returning admitted_at, credit_cost
        )
        select date_trunc('month', admitted_at)::date as month_start,
               sum(credit_cost)::bigint as credits
          from expired
         group by 1
    loop
        update public.api_usage_monthly
           set credits_reserved = greatest(credits_reserved - v_expired.credits, 0),
               updated_at = v_now
         where consumer_id = p_consumer_id
           and month_start = v_expired.month_start;
    end loop;

    insert into public.api_rate_limit_windows (
        consumer_id,
        window_start,
        request_count,
        updated_at
    ) values (
        p_consumer_id,
        v_window_start,
        1,
        v_now
    )
    on conflict (consumer_id, window_start) do update
        set request_count = public.api_rate_limit_windows.request_count + 1,
            updated_at = v_now
        where public.api_rate_limit_windows.request_count < p_requests_per_minute
    returning request_count into v_request_count;

    if v_request_count is null then
        insert into public.api_usage_events (
            request_id,
            consumer_id,
            route_key,
            credit_cost,
            admitted_at,
            completed_at,
            response_status,
            billable,
            outcome
        ) values (
            p_request_id,
            p_consumer_id,
            p_route_key,
            p_credit_cost,
            v_now,
            v_now,
            429,
            false,
            'rejected_rate'
        );
        return jsonb_build_object(
            'allowed', false,
            'reason', 'RATE_LIMIT_EXCEEDED',
            'limit', p_requests_per_minute,
            'remaining', 0,
            'retry_after_seconds', v_retry_after
        );
    end if;

    insert into public.api_usage_monthly (
        consumer_id,
        month_start,
        credits_used,
        credits_reserved,
        updated_at
    ) values (
        p_consumer_id,
        v_month_start,
        0,
        p_credit_cost,
        v_now
    )
    on conflict (consumer_id, month_start) do update
        set credits_reserved = public.api_usage_monthly.credits_reserved + p_credit_cost,
            updated_at = v_now
        where p_monthly_credit_limit = 0
           or public.api_usage_monthly.credits_used
              + public.api_usage_monthly.credits_reserved
              + p_credit_cost <= p_monthly_credit_limit;

    if not found then
        insert into public.api_usage_events (
            request_id,
            consumer_id,
            route_key,
            credit_cost,
            admitted_at,
            completed_at,
            response_status,
            billable,
            outcome
        ) values (
            p_request_id,
            p_consumer_id,
            p_route_key,
            p_credit_cost,
            v_now,
            v_now,
            429,
            false,
            'rejected_quota'
        );
        return jsonb_build_object(
            'allowed', false,
            'reason', 'MONTHLY_QUOTA_EXCEEDED',
            'limit', p_requests_per_minute,
            'remaining', greatest(p_requests_per_minute - v_request_count, 0),
            'retry_after_seconds', v_retry_after
        );
    end if;

    insert into public.api_usage_events (
        request_id,
        consumer_id,
        route_key,
        credit_cost,
        admitted_at,
        outcome
    ) values (
        p_request_id,
        p_consumer_id,
        p_route_key,
        p_credit_cost,
        v_now,
        'pending'
    );

    return jsonb_build_object(
        'allowed', true,
        'reason', null,
        'limit', p_requests_per_minute,
        'remaining', greatest(p_requests_per_minute - v_request_count, 0),
        'retry_after_seconds', v_retry_after
    );
end;
$$;

create or replace function public.api_usage_finalize_v1(
    p_request_id text,
    p_response_status integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_event public.api_usage_events%rowtype;
    v_month_start date;
    v_billable boolean;
begin
    if p_response_status not between 100 and 599 then
        raise exception 'invalid response status';
    end if;

    select *
      into v_event
      from public.api_usage_events
     where request_id = p_request_id;

    if not found or v_event.outcome <> 'pending' then
        return jsonb_build_object('finalized', false, 'idempotent', true);
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_event.consumer_id::text, 0));

    select *
      into v_event
      from public.api_usage_events
     where request_id = p_request_id
       and outcome = 'pending'
     for update;

    if not found then
        return jsonb_build_object('finalized', false, 'idempotent', true);
    end if;

    v_month_start := date_trunc('month', v_event.admitted_at)::date;
    v_billable := p_response_status between 200 and 399;

    update public.api_usage_monthly
       set credits_reserved = greatest(credits_reserved - v_event.credit_cost, 0),
           credits_used = credits_used + case when v_billable then v_event.credit_cost else 0 end,
           updated_at = clock_timestamp()
     where consumer_id = v_event.consumer_id
       and month_start = v_month_start;

    update public.api_usage_events
       set completed_at = clock_timestamp(),
           response_status = p_response_status,
           billable = v_billable,
           outcome = case when v_billable then 'succeeded' else 'failed' end
     where request_id = p_request_id;

    return jsonb_build_object('finalized', true, 'billable', v_billable);
end;
$$;

revoke all on function public.api_usage_admit_v1(text, uuid, text, integer, integer, bigint)
    from public, anon, authenticated;
revoke all on function public.api_usage_finalize_v1(text, integer)
    from public, anon, authenticated;

grant execute on function public.api_usage_admit_v1(text, uuid, text, integer, integer, bigint)
    to service_role;
grant execute on function public.api_usage_finalize_v1(text, integer)
    to service_role;

comment on table public.api_usage_events is
    'Idempotent request-level admission and finalization ledger for the Jyothisyam API.';
comment on table public.api_usage_monthly is
    'Per-consumer monthly used and pending credit counters.';
comment on table public.api_rate_limit_windows is
    'Shared fixed-minute request counters for authenticated API consumers.';;
