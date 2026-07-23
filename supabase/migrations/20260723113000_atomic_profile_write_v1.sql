create or replace function public.write_horos_profile_v1(
  p_user_id uuid,
  p_identifier_hash text,
  p_full_name text,
  p_gender text,
  p_preferred_language text,
  p_current_city text,
  p_notification_time time,
  p_date_of_birth date,
  p_time_of_birth time,
  p_birth_place text,
  p_timezone text,
  p_latitude double precision,
  p_longitude double precision,
  p_altitude_meters double precision,
  p_rashi text,
  p_nakshatra text,
  p_lagna text,
  p_chart_json jsonb,
  p_calculation_profile text,
  p_calculation_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trial_status text;
begin
  if p_user_id is null or not exists (
    select 1 from auth.users where id = p_user_id
  ) then
    raise exception 'Unknown Horos user';
  end if;

  if p_identifier_hash is null or p_identifier_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid trial identifier hash';
  end if;

  if p_chart_json is null or jsonb_typeof(p_chart_json) <> 'object' then
    raise exception 'Invalid chart payload';
  end if;

  if p_calculation_mode <> 'provider' then
    raise exception 'Unsupported profile calculation mode';
  end if;

  insert into public.profiles(
    user_id,
    full_name,
    gender,
    preferred_language,
    current_city,
    notification_time
  )
  values (
    p_user_id,
    p_full_name,
    p_gender,
    p_preferred_language,
    p_current_city,
    p_notification_time
  )
  on conflict (user_id) do update
  set
    full_name = excluded.full_name,
    gender = excluded.gender,
    preferred_language = excluded.preferred_language,
    current_city = excluded.current_city,
    notification_time = excluded.notification_time,
    updated_at = now();

  insert into public.birth_details(
    user_id,
    date_of_birth,
    time_of_birth,
    birth_place,
    timezone,
    latitude,
    longitude,
    altitude_meters,
    rashi,
    nakshatra,
    lagna,
    chart_json,
    calculation_profile,
    calculation_mode
  )
  values (
    p_user_id,
    p_date_of_birth,
    p_time_of_birth,
    p_birth_place,
    p_timezone,
    p_latitude,
    p_longitude,
    p_altitude_meters,
    p_rashi,
    p_nakshatra,
    p_lagna,
    p_chart_json,
    p_calculation_profile,
    p_calculation_mode
  )
  on conflict (user_id) do update
  set
    date_of_birth = excluded.date_of_birth,
    time_of_birth = excluded.time_of_birth,
    birth_place = excluded.birth_place,
    timezone = excluded.timezone,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    altitude_meters = excluded.altitude_meters,
    rashi = excluded.rashi,
    nakshatra = excluded.nakshatra,
    lagna = excluded.lagna,
    chart_json = excluded.chart_json,
    calculation_profile = excluded.calculation_profile,
    calculation_mode = excluded.calculation_mode,
    updated_at = now();

  delete from public.horoscope_cache
  where user_id = p_user_id;

  select public.claim_horos_trial_v1(p_user_id, p_identifier_hash)
  into v_trial_status;

  return jsonb_build_object(
    'written', true,
    'trialStatus', v_trial_status
  );
end;
$$;

revoke all on function public.write_horos_profile_v1(
  uuid,
  text,
  text,
  text,
  text,
  text,
  time,
  date,
  time,
  text,
  text,
  double precision,
  double precision,
  double precision,
  text,
  text,
  text,
  jsonb,
  text,
  text
) from public;
revoke all on function public.write_horos_profile_v1(
  uuid,
  text,
  text,
  text,
  text,
  text,
  time,
  date,
  time,
  text,
  text,
  double precision,
  double precision,
  double precision,
  text,
  text,
  text,
  jsonb,
  text,
  text
) from anon;
revoke all on function public.write_horos_profile_v1(
  uuid,
  text,
  text,
  text,
  text,
  text,
  time,
  date,
  time,
  text,
  text,
  double precision,
  double precision,
  double precision,
  text,
  text,
  text,
  jsonb,
  text,
  text
) from authenticated;
grant execute on function public.write_horos_profile_v1(
  uuid,
  text,
  text,
  text,
  text,
  text,
  time,
  date,
  time,
  text,
  text,
  double precision,
  double precision,
  double precision,
  text,
  text,
  text,
  jsonb,
  text,
  text
) to service_role;
