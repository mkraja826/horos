[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ExpectedProjectRef = "hdaugtypjpniesdgyral"
$BlockedProjectRef = "mzjtdcpb" + "voximdukpukd"
$FunctionName = "horos-api"
$ExpectedApiUrl = "https://$ExpectedProjectRef.supabase.co/functions/v1/$FunctionName"

$RequiredEdgeVariables = @(
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ASTRO_API_URL",
    "ASTRO_API_KEY",
    "ENVIRONMENT",
    "REVENUECAT_SECRET_KEY",
    "REVENUECAT_WEBHOOK_SECRET"
)

$RequiredMigrations = @(
    "supabase/migrations/20260721053407_horos_core_schema_v1.sql",
    "supabase/migrations/20260721054513_atomic_trial_claim_v1.sql",
    "supabase/migrations/20260721061912_explicit_service_only_policies_v1.sql"
)

function Assert-File {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path $Path -PathType Leaf)) {
        throw "Required repository file is missing: $Path"
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

function Get-GitMatches {
    param(
        [Parameter(Mandatory = $true)][string]$Pattern,
        [string[]]$Paths = @(".")
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $matches = @(git grep -n -I --fixed-strings -- $Pattern -- @Paths 2>$null)
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0 -and $exitCode -ne 1) {
        throw "Unable to scan tracked files for: $Pattern"
    }
    return $matches
}

function Read-EnvExample {
    param([Parameter(Mandatory = $true)][string]$Path)
    $values = @{}
    foreach ($line in Get-Content $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
            continue
        }
        $parts = $trimmed.Split("=", 2)
        $values[$parts[0].Trim()] = $parts[1].Trim()
    }
    return $values
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
    Write-Host "Horos hosted-deployment readiness audit"
    Write-Host "Repository: $repoRoot"

    git rev-parse --is-inside-work-tree *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "This script must run inside the Horos Git repository."
    }

    $status = @(git status --porcelain)
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read Git working-tree status."
    }
    if ($status.Count -gt 0) {
        throw "The Horos working tree is not clean. Commit or stash local changes before auditing."
    }

    $branchOutput = @(git branch --show-current)
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read the current Git branch."
    }
    $branch = if ($branchOutput.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace([string]$branchOutput[0])) {
        ([string]$branchOutput[0]).Trim()
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:GITHUB_HEAD_REF)) {
        $env:GITHUB_HEAD_REF.Trim()
    }
    else {
        "detached-head"
    }
    $head = (git rev-parse --short HEAD).Trim()

    $requiredFiles = @(
        ".env.example",
        "app.config.ts",
        "eas.json",
        "supabase/config.toml",
        "supabase/functions/horos-api/index.ts",
        "supabase/functions/horos-api/db.ts",
        "supabase/functions/horos-api/astro.ts",
        "supabase/functions/horos-api/subscriptions.ts"
    ) + $RequiredMigrations
    foreach ($path in $requiredFiles) {
        Assert-File $path
    }

    $blockedMatches = @(Get-GitMatches -Pattern $BlockedProjectRef)
    if ($blockedMatches.Count -gt 0) {
        throw "Blocked MDMS project reference exists in tracked Horos files."
    }

    $publicEnv = Read-EnvExample ".env.example"
    if ($publicEnv["EXPO_PUBLIC_API_URL"] -ne $ExpectedApiUrl) {
        throw "EXPO_PUBLIC_API_URL is not bound to the intended Horos Edge Function."
    }
    if ($publicEnv["EXPO_PUBLIC_ALLOW_DEMO_DATA"] -ne "false") {
        throw "Demo data must remain disabled in the checked-in environment example."
    }

    $serverOnlyNames = @(
        "SUPABASE_SERVICE_ROLE_KEY",
        "ASTRO_API_KEY",
        "REVENUECAT_SECRET_KEY",
        "REVENUECAT_WEBHOOK_SECRET"
    )
    $mobilePaths = @("app", "components", "constants", "hooks", "lib", "providers", "app.config.ts", "eas.json", ".env.example")
    foreach ($name in $serverOnlyNames) {
        $matches = @(Get-GitMatches -Pattern $name -Paths $mobilePaths)
        if ($matches.Count -gt 0) {
            throw "Server-only variable name appears in mobile code or public configuration: $name"
        }
    }

    $configToml = Get-Content "supabase/config.toml" -Raw
    Assert-Contains $configToml "[functions.$FunctionName]" "Supabase function configuration is missing."
    if ($configToml -notmatch "(?m)^verify_jwt\s*=\s*false\s*$") {
        throw "horos-api must disable gateway JWT verification because health, OTP, and webhook routes are public; protected routes authenticate inside the function."
    }

    $indexSource = Get-Content "supabase/functions/horos-api/index.ts" -Raw
    $dbSource = Get-Content "supabase/functions/horos-api/db.ts" -Raw
    $astroSource = Get-Content "supabase/functions/horos-api/astro.ts" -Raw
    $subscriptionSource = Get-Content "supabase/functions/horos-api/subscriptions.ts" -Raw
    $edgeSource = "$indexSource`n$dbSource`n$astroSource`n$subscriptionSource"

    foreach ($name in $RequiredEdgeVariables) {
        if (-not $edgeSource.Contains($name)) {
            throw "Required Edge Function environment variable is not referenced by the active backend: $name"
        }
    }

    Assert-Contains $indexSource 'path === "/auth/login"' "Public OTP route is missing."
    Assert-Contains $indexSource 'path === "/subscription/webhook"' "RevenueCat webhook route is missing."
    Assert-Contains $indexSource "const user = await requireUser(request);" "Protected route authentication boundary is missing."
    if ($indexSource.IndexOf('path === "/auth/login"') -gt $indexSource.IndexOf("const user = await requireUser(request);")) {
        throw "OTP route is incorrectly placed behind the authenticated-route boundary."
    }
    if ($indexSource.IndexOf('path === "/subscription/webhook"') -gt $indexSource.IndexOf("const user = await requireUser(request);")) {
        throw "Webhook route is incorrectly placed behind the user-authenticated boundary."
    }

    Assert-Contains $indexSource "ALLOWED_ORIGINS" "Production CORS allow-list configuration is missing."
    Assert-Contains $indexSource 'environment !== "production"' "Production CORS enforcement is missing."
    Assert-Contains $indexSource 'Vary: "Origin"' "CORS responses must vary by Origin."
    Assert-Contains $astroSource 'parsed.protocol !== "https:"' "Production Astro provider HTTPS enforcement is missing."
    Assert-Contains $astroSource '"X-Astro-Consumer-ID"' "Astro consumer metering header is missing."
    Assert-Contains $astroSource '"X-Request-ID"' "Astro request idempotency header is missing."

    $coreMigration = Get-Content $RequiredMigrations[0] -Raw
    $trialMigration = Get-Content $RequiredMigrations[1] -Raw
    $serviceOnlyMigration = Get-Content $RequiredMigrations[2] -Raw
    Assert-Contains $coreMigration "alter table public.profiles enable row level security" "Core profiles RLS is missing."
    Assert-Contains $coreMigration "alter table public.subscriptions enable row level security" "Subscriptions RLS is missing."
    Assert-Contains $trialMigration "grant execute on function public.claim_horos_trial_v1(uuid, text) to service_role" "Atomic trial claim is not service-role restricted."
    Assert-Contains $serviceOnlyMigration "trial_ledger_service_only" "Trial ledger default-deny policy is missing."
    Assert-Contains $serviceOnlyMigration "webhook_events_service_only" "Webhook event default-deny policy is missing."

    $eas = Get-Content "eas.json" -Raw | ConvertFrom-Json
    if ($eas.build.production.env.EXPO_PUBLIC_APP_ENV -ne "production") {
        throw "EAS production builds must set EXPO_PUBLIC_APP_ENV=production."
    }
    if ([string]$eas.build.production.env.EXPO_PUBLIC_ALLOW_DEMO_DATA -ne "false") {
        throw "EAS production builds must disable demo data."
    }

    $legacyDeploy = @(Get-GitMatches -Pattern '"worker:deploy"' -Paths @("package.json"))

    [pscustomobject]@{
        Branch                    = $branch
        Head                      = $head
        ProjectRef                = $ExpectedProjectRef
        Function                  = $FunctionName
        MobileApiUrl              = $ExpectedApiUrl
        GatewayJwtVerification    = "disabled-by-config"
        ProtectedRouteAuth        = "function-enforced"
        RepositoryMigrations      = $RequiredMigrations.Count
        MdmsReferences            = 0
        ServerSecretsInMobile     = 0
        LegacyWorkerDeployScript  = if ($legacyDeploy.Count) { "present-warning" } else { "absent" }
    } | Format-List

    Write-Host "Static repository readiness: PASS"
    Write-Host "External gates still pending: hosted Astro HTTPS URL, remote migration state, Edge Function secrets, Edge deployment, OTP delivery, RevenueCat verification, and mobile EAS public variables."
    Write-Host "Horos hosted-deployment readiness audit passed."
    Write-Host "No cloud state was read or changed."
}
finally {
    Pop-Location
}
