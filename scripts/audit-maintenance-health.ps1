[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$MigrationPath = "supabase/migrations/20260723134500_maintenance_health_monitoring_v1.sql"

function Assert-Contains {
    param(
        [Parameter(Mandatory = $true)][string]$Content,
        [Parameter(Mandatory = $true)][string]$Expected,
        [Parameter(Mandatory = $true)][string]$Message
    )
    if (-not $Content.Contains($Expected)) {
        throw $Message
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    if (-not (Test-Path $MigrationPath -PathType Leaf)) {
        throw "Maintenance-health migration is missing: $MigrationPath"
    }

    $migration = Get-Content $MigrationPath -Raw

    Assert-Contains $migration "create table if not exists public.maintenance_runs" "Maintenance run ledger is missing."
    Assert-Contains $migration "create table if not exists public.maintenance_alerts" "Maintenance alert ledger is missing."
    Assert-Contains $migration "alter table public.maintenance_runs enable row level security" "Maintenance run RLS is missing."
    Assert-Contains $migration "alter table public.maintenance_alerts enable row level security" "Maintenance alert RLS is missing."
    Assert-Contains $migration "maintenance_runs_service_only" "Maintenance run default-deny policy is missing."
    Assert-Contains $migration "maintenance_alerts_service_only" "Maintenance alert default-deny policy is missing."
    Assert-Contains $migration "run_horos_retention_monitored_v1" "Monitored retention wrapper is missing."
    Assert-Contains $migration "refresh_horos_maintenance_alerts_v1" "Maintenance watchdog function is missing."
    Assert-Contains $migration "get_horos_maintenance_health_v1" "Admin health summary RPC is missing."
    Assert-Contains $migration "get stacked diagnostics" "Retention failures are not captured safely."
    Assert-Contains $migration "retention_run_failed" "Retention failure alert is missing."
    Assert-Contains $migration "retention_run_missed" "Missed-run alert is missing."
    Assert-Contains $migration "maintenance_schedule_inactive" "Inactive schedule alert is missing."
    Assert-Contains $migration "retention_cleanup_backlog" "Cleanup backlog alert is missing."
    Assert-Contains $migration "interval '30 hours'" "Missed-run threshold changed unexpectedly."
    Assert-Contains $migration "'horos-daily-retention-v1'" "Monitored daily retention schedule is missing."
    Assert-Contains $migration "'horos-maintenance-watchdog-v1'" "Maintenance watchdog schedule is missing."
    Assert-Contains $migration "'27 * * * *'" "Hourly watchdog cadence changed unexpectedly."
    Assert-Contains $migration "grant execute on function public.get_horos_maintenance_health_v1" "Health RPC is not service-role accessible."
    Assert-Contains $migration "from public, anon, authenticated" "Public maintenance execution was not revoked."
    Assert-Contains $migration "completed_at is not null" "Incomplete maintenance runs may be deleted."
    Assert-Contains $migration "status = 'resolved'" "Open alerts may be deleted by retention."

    if ($migration -match "grant execute on function public.get_horos_maintenance_health_v1[\s\S]{0,200}to (anon|authenticated)") {
        throw "Maintenance health must not be exposed to mobile roles."
    }

    Write-Host "Horos maintenance-health contract: PASS"
}
finally {
    Pop-Location
}
