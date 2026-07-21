alter table public.horoscope_cache
  drop constraint if exists horoscope_cache_calculation_mode_check;

alter table public.horoscope_cache
  add constraint horoscope_cache_calculation_mode_check
  check (calculation_mode in ('provider', 'estimated', 'editorial'));
