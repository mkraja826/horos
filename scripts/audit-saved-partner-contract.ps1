[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-File {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path $Path -PathType Leaf)) {
        throw "Required saved-partner file is missing: $Path"
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
        "supabase/migrations/20260724203000_saved_compatibility_partners_v1.sql",
        "supabase/functions/horos-api/saved_partner_contract.ts",
        "supabase/functions/horos-api/saved_partners.ts",
        "supabase/functions/horos-api/saved_partner_contract_test.ts",
        "types/saved-partners.ts"
    )
    foreach ($path in $requiredFiles) { Assert-File $path }

    $migration = Get-Content "supabase/migrations/20260724203000_saved_compatibility_partners_v1.sql" -Raw
    $contract = Get-Content "supabase/functions/horos-api/saved_partner_contract.ts" -Raw
    $storage = Get-Content "supabase/functions/horos-api/saved_partners.ts" -Raw
    $compatibility = Get-Content "supabase/functions/horos-api/compatibility.ts" -Raw
    $provider = Get-Content "supabase/functions/horos-api/compatibility_provider.ts" -Raw
    $index = Get-Content "supabase/functions/horos-api/index.ts" -Raw
    $mobile = Get-Content "app/compatibility.tsx" -Raw

    Assert-Contains $migration "references auth.users(id) on delete cascade" "Saved partners do not cascade with account deletion."
    Assert-Contains $migration "consent_recorded_at timestamptz not null" "Consent timestamp is missing."
    Assert-Contains $migration "enable row level security" "Saved-partner RLS is missing."
    Assert-Contains $migration "revoke all on table public.saved_compatibility_partners from public, anon, authenticated" "Saved partner table is not default denied."
    Assert-Contains $migration "to service_role" "Saved partner table is not restricted to the service role."

    Assert-Contains $contract "body.consentToSave !== true" "Explicit true consent is not enforced."
    Assert-Contains $contract "SAVED_PARTNER_CONSENT_REQUIRED" "Consent failure code is missing."
    Assert-Contains $compatibility "Choose exactly one direct partner birth or saved partner profile." "Direct/saved selection exclusivity is missing."
    Assert-Contains $storage ".eq(`"user_id`", userId)" "Saved partner ownership filtering is missing."
    Assert-Contains $storage "MAX_SAVED_PARTNERS = 10" "Saved partner count limit is missing."
    Assert-Contains $storage "resolveCompatibilitySelection" "Saved partner resolution is missing."
    Assert-Contains $index 'path === "/compatibility/partners"' "Saved partner list/create route is missing."
    Assert-Contains $index 'path.startsWith("/compatibility/partners/")' "Saved partner delete route is missing."
    Assert-Contains $index "resolveCompatibilitySelection(user.id, selection)" "Compatibility calculations do not resolve owned saved profiles."

    if ($provider.Contains("label") -or $provider.Contains("consent_recorded_at")) {
        throw "Compatibility provider code may forward saved-profile metadata."
    }
    Assert-Contains $provider "partner_birth" "Compatibility provider partner birth payload is missing."
    Assert-Contains $mobile "I consent to Horos storing these sensitive birth details" "Mobile explicit-consent copy is missing."
    Assert-Contains $mobile "deleteCompatibilityPartner" "Mobile saved-profile deletion is missing."
    Assert-Contains $mobile "Use one-time details" "Mobile ephemeral mode is missing."

    Write-Host "Saved compatibility partner contract: PASS"
    Write-Host "Persistence: explicit consent only"
    Write-Host "Provider metadata: label and consent excluded"
    Write-Host "Deletion: individual control plus account cascade"
}
finally {
    Pop-Location
}
