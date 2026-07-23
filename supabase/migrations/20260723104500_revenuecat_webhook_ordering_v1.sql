alter table public.subscriptions
  add column provider_event_timestamp_ms bigint not null default 0,
  add column provider_event_priority smallint not null default 0,
  add column provider_event_id text;

alter table public.subscriptions
  add constraint subscriptions_provider_event_priority_check
  check (provider_event_priority between 0 and 100);

alter table public.webhook_events
  add column event_timestamp_ms bigint,
  add column event_type text,
  add column app_user_id text,
  add column processed_at timestamptz,
  add column processing_result text;

create index webhook_events_app_user_timestamp_idx
on public.webhook_events(app_user_id, event_timestamp_ms desc)
where app_user_id is not null;

create index webhook_events_processing_result_idx
on public.webhook_events(processing_result, received_at desc)
where processing_result is not null;

create or replace function public.process_revenuecat_webhook_v1(
  p_event_id text,
  p_event_timestamp_ms bigint,
  p_event_priority integer,
  p_event_type text,
  p_app_user_id text,
  p_user_id uuid,
  p_platform text,
  p_product_id text,
  p_status text,
  p_purchased_at timestamptz,
  p_expires_at timestamptz,
  p_payload jsonb,
  p_processing_result text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted_count integer := 0;
  v_upserted_count integer := 0;
  v_current_timestamp bigint := -1;
  v_current_priority integer := -1;
  v_current_event_id text := '';
  v_subscription_found boolean := false;
begin
  if p_event_id is null or length(trim(p_event_id)) = 0 or length(p_event_id) > 200 then
    raise exception 'Invalid RevenueCat event id';
  end if;
  if p_event_timestamp_ms is null or p_event_timestamp_ms <= 0 then
    raise exception 'Invalid RevenueCat event timestamp';
  end if;
  if p_event_priority is null or p_event_priority < 0 or p_event_priority > 100 then
    raise exception 'Invalid RevenueCat event priority';
  end if;
  if p_event_type is null or length(trim(p_event_type)) = 0 or length(p_event_type) > 100 then
    raise exception 'Invalid RevenueCat event type';
  end if;
  if p_platform is not null and p_platform not in ('android', 'ios') then
    raise exception 'Invalid subscription platform';
  end if;
  if p_status is not null and p_status not in ('active', 'cancelled', 'expired') then
    raise exception 'Invalid subscription status';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid RevenueCat payload';
  end if;

  insert into public.webhook_events(
    id,
    provider,
    payload_json,
    event_timestamp_ms,
    event_type,
    app_user_id,
    processed_at,
    processing_result
  )
  values (
    trim(p_event_id),
    'revenuecat',
    p_payload,
    p_event_timestamp_ms,
    trim(p_event_type),
    nullif(trim(coalesce(p_app_user_id, '')), ''),
    now(),
    nullif(trim(coalesce(p_processing_result, '')), '')
  )
  on conflict (id) do nothing;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count = 0 then
    return jsonb_build_object(
      'processed', false,
      'reason', 'duplicate',
      'eventId', p_event_id
    );
  end if;

  if p_status is null then
    return jsonb_build_object(
      'processed', false,
      'reason', coalesce(nullif(trim(p_processing_result), ''), 'ledger_only'),
      'eventId', p_event_id
    );
  end if;

  if p_user_id is null or not exists (
    select 1 from auth.users where id = p_user_id
  ) then
    update public.webhook_events
    set processing_result = 'ignored_unknown_user'
    where id = p_event_id;

    return jsonb_build_object(
      'processed', false,
      'reason', 'ignored_unknown_user',
      'eventId', p_event_id
    );
  end if;

  select
    provider_event_timestamp_ms,
    provider_event_priority,
    coalesce(provider_event_id, '')
  into
    v_current_timestamp,
    v_current_priority,
    v_current_event_id
  from public.subscriptions
  where user_id = p_user_id
  for update;

  v_subscription_found := found;

  if v_subscription_found and (
    p_event_timestamp_ms < v_current_timestamp
    or (
      p_event_timestamp_ms = v_current_timestamp
      and p_event_priority < v_current_priority
    )
    or (
      p_event_timestamp_ms = v_current_timestamp
      and p_event_priority = v_current_priority
      and p_event_id <= v_current_event_id
    )
  ) then
    update public.webhook_events
    set processing_result = 'ignored_stale_event'
    where id = p_event_id;

    return jsonb_build_object(
      'processed', false,
      'reason', 'ignored_stale_event',
      'eventId', p_event_id
    );
  end if;

  insert into public.subscriptions(
    user_id,
    platform,
    product_id,
    provider_customer_id,
    status,
    subscription_start_date,
    subscription_end_date,
    provider_event_timestamp_ms,
    provider_event_priority,
    provider_event_id
  )
  values (
    p_user_id,
    p_platform,
    nullif(trim(coalesce(p_product_id, '')), ''),
    nullif(trim(coalesce(p_app_user_id, '')), ''),
    p_status,
    p_purchased_at,
    p_expires_at,
    p_event_timestamp_ms,
    p_event_priority,
    p_event_id
  )
  on conflict (user_id) do update
  set
    platform = coalesce(excluded.platform, subscriptions.platform),
    product_id = coalesce(excluded.product_id, subscriptions.product_id),
    provider_customer_id = coalesce(excluded.provider_customer_id, subscriptions.provider_customer_id),
    status = excluded.status,
    subscription_start_date = coalesce(
      excluded.subscription_start_date,
      subscriptions.subscription_start_date
    ),
    subscription_end_date = excluded.subscription_end_date,
    provider_event_timestamp_ms = excluded.provider_event_timestamp_ms,
    provider_event_priority = excluded.provider_event_priority,
    provider_event_id = excluded.provider_event_id
  where
    excluded.provider_event_timestamp_ms > subscriptions.provider_event_timestamp_ms
    or (
      excluded.provider_event_timestamp_ms = subscriptions.provider_event_timestamp_ms
      and excluded.provider_event_priority > subscriptions.provider_event_priority
    )
    or (
      excluded.provider_event_timestamp_ms = subscriptions.provider_event_timestamp_ms
      and excluded.provider_event_priority = subscriptions.provider_event_priority
      and excluded.provider_event_id > coalesce(subscriptions.provider_event_id, '')
    );

  get diagnostics v_upserted_count = row_count;
  if v_upserted_count = 0 then
    update public.webhook_events
    set processing_result = 'ignored_stale_event'
    where id = p_event_id;

    return jsonb_build_object(
      'processed', false,
      'reason', 'ignored_stale_event',
      'eventId', p_event_id
    );
  end if;

  return jsonb_build_object(
    'processed', true,
    'reason', coalesce(nullif(trim(p_processing_result), ''), 'applied'),
    'eventId', p_event_id,
    'status', p_status
  );
end;
$$;

revoke all on function public.process_revenuecat_webhook_v1(
  text,
  bigint,
  integer,
  text,
  text,
  uuid,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb,
  text
) from public;
revoke all on function public.process_revenuecat_webhook_v1(
  text,
  bigint,
  integer,
  text,
  text,
  uuid,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb,
  text
) from anon;
revoke all on function public.process_revenuecat_webhook_v1(
  text,
  bigint,
  integer,
  text,
  text,
  uuid,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb,
  text
) from authenticated;
grant execute on function public.process_revenuecat_webhook_v1(
  text,
  bigint,
  integer,
  text,
  text,
  uuid,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb,
  text
) to service_role;
