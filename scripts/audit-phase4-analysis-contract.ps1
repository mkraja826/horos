[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-File {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path $Path -PathType Leaf)) {
        throw "Required Phase 4 analysis file is missing: $Path"
    }
}

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
    $requiredFiles = @(
        "supabase/functions/horos-api/analysis.ts",
        "supabase/functions/horos-api/analysis_provider.ts",
        "supabase/functions/horos-api/analysis_contract.ts",
        "supabase/functions/horos-api/analysis_cache.ts",
        "supabase/functions/horos-api/analysis_test.ts",
        "supabase/migrations/20260724190000_phase4_analysis_cache_v1.sql",
        "supabase/migrations/20260724190500_phase4_analysis_retention_v1.sql",
        "app/life-profile.tsx",
        "app/year-analysis.tsx",
        "app/month-analysis.tsx",
        "components/analysis-cards.tsx",
        "types/phase4-analysis.ts"
    )
    foreach ($path in $requiredFiles) {
        Assert-File $path
    }

    $analysis = Get-Content "supabase/functions/horos-api/analysis.ts" -Raw
    $provider = Get-Content "supabase/functions/horos-api/analysis_provider.ts" -Raw
    $contract = Get-Content "supabase/functions/horos-api/analysis_contract.ts" -Raw
    $cache = Get-Content "supabase/functions/horos-api/analysis_cache.ts" -Raw
    $index = Get-Content "supabase/functions/horos-api/index.ts" -Raw
    $cacheMigration = Get-Content "supabase/migrations/20260724190000_phase4_analysis_cache_v1.sql" -Raw
    $retentionMigration = Get-Content "supabase/migrations/20260724190500_phase4_analysis_retention_v1.sql" -Raw
    $featureFlags = Get-Content "lib/feature-flags.ts" -Raw
    $eas = Get-Content "eas.json" -Raw | ConvertFrom-Json
    $envExample = Get-Content ".env.example" -Raw

    Assert-Contains $analysis 'PHASE4_ANALYSIS_ENABLED' "Backend analysis flag is missing."
    Assert-Contains $index 'path === "/analysis/life-profile"' "Life Profile route is missing."
    Assert-Contains $index 'path === "/analysis/year"' "Year analysis route is missing."
    Assert-Contains $index 'path === "/analysis/month"' "Month analysis route is missing."
    Assert-Contains $index 'if (!isPhase4AnalysisEnabled())' "Analysis routes do not fail closed."
    Assert-Contains $index 'PREMIUM_REQUIRED' "Analysis premium gate is missing."

    Assert-Contains $provider 'civil_month_midpoint_local_noon_v1' "Deterministic month sampling is missing."
    Assert-Contains $provider 'exact_boundary_calculation_applied' "Exact-boundary limitation is missing."
    Assert-Contains $provider 'storedBirthPayload' "Stored birth adapter is missing."
    if ($provider.Contains("full_name") -or $provider.Contains("birth_place") -or $provider.Contains("current_city")) {
        throw "Phase 4 provider payload includes identity or place-label fields."
    }

    Assert-Contains $contract 'life_profile_facts_v1' "Life Profile facts version is not pinned."
    Assert-Contains $contract 'period_analysis_facts_v1' "Period facts version is not pinned."
    Assert-Contains $contract 'outlook_index_v1' "Outlook index version is not pinned."
    Assert-Contains $contract 'RAW_BIRTH_KEYS' "Raw birth-key response leakage check is missing."
    Assert-Contains $contract 'horos_brihat_jataka_v2' "Production interpretation version changed."

    Assert-Contains $cache 'analysisChartFingerprint' "Chart fingerprinting is missing."
    Assert-Contains $cache 'calculation_profile,classical_profile,engine_version,facts_version,interpretation_version' "Cache identity is not fully versioned."
    Assert-Contains $cacheMigration 'on delete cascade' "Account deletion does not cascade to analysis cache."
    Assert-Contains $cacheMigration 'enable row level security' "Analysis cache RLS is missing."
    Assert-Contains $cacheMigration 'revoke all on table public.phase4_analysis_cache from public, anon, authenticated' "Analysis cache is not default-denied."
    Assert-Contains $retentionMigration 'public.phase4_analysis_cache' "Expired analysis cache retention is missing."
    Assert-Contains $retentionMigration 'for update skip locked' "Analysis cache retention can block active rows."

    Assert-Contains $featureFlags 'EXPO_PUBLIC_PHASE4_ANALYSIS_ENABLED === "true"' "Mobile analysis flag is missing."
    Assert-Contains $envExample 'EXPO_PUBLIC_PHASE4_ANALYSIS_ENABLED=false' "Environment example must keep analysis disabled."
    foreach ($profileName in @("preview", "private-beta", "production")) {
        $profile = $eas.build.$profileName
        if ([string]$profile.env.EXPO_PUBLIC_PHASE4_ANALYSIS_ENABLED -ne "false") {
            throw "EAS profile $profileName must keep Phase 4 analysis disabled."
        }
    }

    Write-Host "Phase 4 Life Profile and period analysis contract: PASS"
    Write-Host "Routes: default closed"
    Write-Host "Partner/person names: excluded"
    Write-Host "Cache: service-only, versioned, retained, account-cascade deletion"
    Write-Host "Mobile release profiles: disabled"
}
finally {
    Pop-Location
}
