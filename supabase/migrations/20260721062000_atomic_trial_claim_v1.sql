create or replace function public.claim_horos_trial_v1(
  p_user_id uuid,
  p_identifier_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean := false;
  v_now timestamptz := now();
begin
  if p_user_id is null or p_identifier_hash is null or length(p_identifier_hash) < 32 then
    raise exception 'Invalid trial claim input';
  end if;

  if exists (select 1 from public.subscriptions where user_id = p_user_id) then
    return (select status from public.subscriptions where user_id = p_user_id);
  end if;

  insert into public.trial_ledger(identifier_hash, first_trial_at)
  values (p_identifier_hash, v_now)
  on conflict (identifier_hash) do nothing;
  v_claimed := found;

  insert into public.subscriptions(
    user_id,
    status,
    trial_start_date,
    trial_end_date
  )
  values (
    p_user_id,
    case when v_claimed then 'trial' else 'expired' end,
    case when v_claimed then v_now else null end,
    case when v_claimed then v_now + interval '30 days' else null end
  )
  on conflict (user_id) do nothing;

  return case when v_claimed then 'trial' else 'expired' end;
end;
$$;

revoke all on function public.claim_horos_trial_v1(uuid, text) from public;
revoke all on function public.claim_horos_trial_v1(uuid, text) from anon;
revoke all on function public.claim_horos_trial_v1(uuid, text) from authenticated;
grant execute on function public.claim_horos_trial_v1(uuid, text) to service_role;
