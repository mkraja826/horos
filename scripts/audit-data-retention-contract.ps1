[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$BaseMigrationPath = "supabase/migrations/20260723131500_automated_data_retention_v1.sql"
$Phase4MigrationPath = "supabase/migrations/20260724190500_phase4_analysis_retention_v1.sql"

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
    foreach ($migrationPath in @($BaseMigrationPath, $Phase4MigrationPath)) {
        if (-not (Test-Path $migrationPath -PathType Leaf)) {
            throw "Retention migration is missing: $migrationPath"
        }
    }

    $baseMigration = Get-Content $BaseMigrationPath -Raw
    $phase4Migration = Get-Content $Phase4MigrationPath -Raw
    $migration = "$baseMigration`n$phase4Migration"

    Assert-Contains $migration "create extension if not exists pg_cron" "Database cron is not enabled."
    Assert-Contains $phase4Migration "cleanup_horos_retention_v1" "Latest retention cleanup function is missing."
    Assert-Contains $phase4Migration "security definer" "Retention cleanup must use a controlled security boundary."
    Assert-Contains $phase4Migration "for update skip locked" "Retention cleanup must avoid blocking active rows."
    Assert-Contains $phase4Migration "limit p_batch_limit" "Retention cleanup must remain batch bounded."
    Assert-Contains $phase4Migration "public.phase4_analysis_cache" "Phase 4 analysis cache retention is missing."
    Assert-Contains $phase4Migration "phase4AnalysisCacheDeleted" "Phase 4 cleanup reporting is missing."
    Assert-Contains $phase4Migration "where completed_at is not null" "In-flight API usage records are not protected."
    Assert-Contains $phase4Migration "where processed_at is not null" "Unprocessed webhook records are not protected."
    Assert-Contains $phase4Migration "interval '7 days'" "Cache grace period is missing."
    Assert-Contains $phase4Migration "interval '2 days'" "OTP-window retention period is missing."
    Assert-Contains $phase4Migration "interval '180 days'" "API usage retention period is missing."
    Assert-Contains $phase4Migration "interval '365 days'" "Webhook retention period is missing."
    Assert-Contains $phase4Migration "grant execute on function public.cleanup_horos_retention_v1" "Service-role cleanup grant is missing."
    Assert-Contains $phase4Migration "revoke all on function public.cleanup_horos_retention_v1" "Public cleanup execution was not revoked."
    Assert-Contains $baseMigration "'horos-daily-retention-v1'" "Daily retention job is missing."
    Assert-Contains $baseMigration "'17 2 * * *'" "Daily retention schedule changed unexpectedly."
    Assert-Contains $phase4Migration "cron.job_run_details" "Cron execution history cleanup is missing."

    Write-Host "Horos data-retention contract: PASS"
}
finally {
    Pop-Location
}
