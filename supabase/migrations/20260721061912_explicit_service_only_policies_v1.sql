create policy app_settings_service_only
on public.app_settings
for all
to anon, authenticated
using (false)
with check (false);

create policy trial_ledger_service_only
on public.trial_ledger
for all
to anon, authenticated
using (false)
with check (false);

create policy webhook_events_service_only
on public.webhook_events
for all
to anon, authenticated
using (false)
with check (false);
