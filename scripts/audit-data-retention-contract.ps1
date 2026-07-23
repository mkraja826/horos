[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$MigrationPath = "supabase/migrations/20260723131500_automated_data_retention_v1.sql"

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
        throw "Retention migration is missing: $MigrationPath"
    }

    $migration = Get-Content $MigrationPath -Raw

    Assert-Contains $migration "create extension if not exists pg_cron" "Database cron is not enabled."
    Assert-Contains $migration "cleanup_horos_retention_v1" "Retention cleanup function is missing."
    Assert-Contains $migration "security definer" "Retention cleanup must use a controlled security boundary."
    Assert-Contains $migration "for update skip locked" "Retention cleanup must avoid blocking active rows."
    Assert-Contains $migration "limit p_batch_limit" "Retention cleanup must remain batch bounded."
    Assert-Contains $migration "where completed_at is not null" "In-flight API usage records are not protected."
    Assert-Contains $migration "where processed_at is not null" "Unprocessed webhook records are not protected."
    Assert-Contains $migration "interval '7 days'" "Horoscope cache grace period is missing."
    Assert-Contains $migration "interval '2 days'" "OTP-window retention period is missing."
    Assert-Contains $migration "interval '180 days'" "API usage retention period is missing."
    Assert-Contains $migration "interval '365 days'" "Webhook retention period is missing."
    Assert-Contains $migration "grant execute on function public.cleanup_horos_retention_v1" "Service-role cleanup grant is missing."
    Assert-Contains $migration "revoke all on function public.cleanup_horos_retention_v1" "Public cleanup execution was not revoked."
    Assert-Contains $migration "'horos-daily-retention-v1'" "Daily retention job is missing."
    Assert-Contains $migration "'17 2 * * *'" "Daily retention schedule changed unexpectedly."
    Assert-Contains $migration "cron.job_run_details" "Cron execution history cleanup is missing."

    Write-Host "Horos data-retention contract: PASS"
}
finally {
    Pop-Location
}
