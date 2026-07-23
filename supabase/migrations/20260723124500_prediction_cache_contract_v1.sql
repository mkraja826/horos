alter table public.horoscope_cache
  add column calculation_profile text,
  add column classical_profile text,
  add column engine_version text,
  add column prediction_contract_version text;

update public.horoscope_cache
set
  calculation_profile = coalesce(
    nullif(content_json ->> 'calculation_profile', ''),
    'south_indian_drik_lahiri_jpl_de440s_v1'
  ),
  classical_profile = coalesce(
    nullif(content_json ->> 'classical_profile', ''),
    'varahamihira_v1'
  ),
  engine_version = coalesce(
    nullif(content_json ->> 'engine_version', ''),
    'horos_brihat_jataka_v2'
  ),
  prediction_contract_version = 'classical_prediction_response_v1',
  content_json = content_json || jsonb_build_object(
    'predictionContractVersion',
    'classical_prediction_response_v1'
  );

alter table public.horoscope_cache
  alter column calculation_profile set default 'south_indian_drik_lahiri_jpl_de440s_v1',
  alter column calculation_profile set not null,
  alter column classical_profile set default 'varahamihira_v1',
  alter column classical_profile set not null,
  alter column engine_version set default 'horos_brihat_jataka_v2',
  alter column engine_version set not null,
  alter column prediction_contract_version set default 'classical_prediction_response_v1',
  alter column prediction_contract_version set not null;

alter table public.horoscope_cache
  add constraint horoscope_cache_calculation_profile_nonempty
    check (char_length(calculation_profile) between 1 and 120),
  add constraint horoscope_cache_classical_profile_nonempty
    check (char_length(classical_profile) between 1 and 120),
  add constraint horoscope_cache_engine_version_nonempty
    check (char_length(engine_version) between 1 and 120),
  add constraint horoscope_cache_prediction_contract_nonempty
    check (char_length(prediction_contract_version) between 1 and 120);

alter table public.horoscope_cache
  add constraint horoscope_cache_versioned_identity_key unique (
    user_id,
    period,
    period_key,
    calculation_profile,
    classical_profile,
    engine_version,
    prediction_contract_version
  );

create index horoscope_cache_active_version_lookup_idx
on public.horoscope_cache (
  user_id,
  period,
  period_key,
  calculation_profile,
  classical_profile,
  engine_version,
  prediction_contract_version,
  expires_at
);
