[CmdletBinding()]
param(
    [switch]$SkipMeteredSmoke
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-ExitCode {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if ($LASTEXITCODE -ne 0) {
        throw $Message
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
    Write-Host "Horos private-beta local preflight"
    Write-Host "Repository: $repoRoot"

    git rev-parse --is-inside-work-tree *> $null
    Assert-ExitCode "This script must be run from the Horos Git repository."

    $status = @(git status --porcelain)
    Assert-ExitCode "Unable to read Git working-tree status."
    if ($status.Count -gt 0) {
        throw "The Horos working tree is not clean. Commit or stash local changes before beta verification."
    }

    $branch = (git branch --show-current).Trim()
    Assert-ExitCode "Unable to determine the current Git branch."
    $head = (git rev-parse --short HEAD).Trim()
    Assert-ExitCode "Unable to determine the current Git commit."

    git check-ignore -q .env
    if ($LASTEXITCODE -ne 0) {
        throw "Horos .env is not protected by .gitignore."
    }

    $trackedSensitive = @(
        git ls-files -- ".env" ".env.local" "*.jks" "*.keystore" "*.p8" "*.p12" "google-service-account.json"
    )
    Assert-ExitCode "Unable to verify tracked sensitive files."
    if ($trackedSensitive.Count -gt 0) {
        throw "Sensitive local files are tracked by Git: $($trackedSensitive -join ', ')"
    }

    docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Desktop is not ready. Open Docker Desktop and rerun this script."
    }

    $containerName = "astro-staging-durable"
    $container = (
        docker ps -a --filter "name=^${containerName}$" --format "{{.Names}}"
    ).Trim()
    Assert-ExitCode "Unable to inspect the Astro staging container."
    if ($container -ne $containerName) {
        throw "The $containerName container is missing. Recreate it from the protected Astro staging setup before continuing."
    }

    $running = (
        docker inspect --format "{{.State.Running}}" $containerName
    ).Trim()
    Assert-ExitCode "Unable to inspect the Astro staging container state."
    if ($running -ne "true") {
        docker start $containerName *> $null
        Assert-ExitCode "Unable to start the Astro staging container."
    }

    Write-Host "Waiting for protected Astro readiness..."
    $health = $null
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        Start-Sleep -Seconds 2
        try {
            $health = Invoke-RestMethod `
                -Uri "http://127.0.0.1:8080/health/ready" `
                -TimeoutSec 5

            if (
                $health.ready -eq $true -and
                $health.usage.ready -eq $true -and
                $health.usage.backend -eq "supabase" -and
                $health.usage.durable -eq $true -and
                $health.usage.reachable -eq $true -and
                $health.usage.project_ref -eq "hdaugtypjpniesdgyral"
            ) {
                break
            }
        }
        catch {
            $health = $null
        }
    }

    if (
        -not $health -or
        $health.ready -ne $true -or
        $health.usage.ready -ne $true -or
        $health.usage.backend -ne "supabase" -or
        $health.usage.durable -ne $true -or
        $health.usage.reachable -ne $true -or
        $health.usage.project_ref -ne "hdaugtypjpniesdgyral"
    ) {
        throw "Protected Astro staging did not pass the durable readiness gate."
    }

    [pscustomobject]@{
        HorosBranch = $branch
        HorosHead   = $head
        AstroReady  = $health.ready
        Backend     = $health.usage.backend
        Durable     = $health.usage.durable
        Reachable   = $health.usage.reachable
        ProjectRef  = $health.usage.project_ref
    } | Format-List

    Write-Host "Running Horos Astro gateway regression tests..."
    npx --yes deno test `
        --config=./supabase/functions/horos-api/deno.json `
        ./supabase/functions/horos-api/astro_test.ts
    Assert-ExitCode "Horos Astro gateway regression tests failed."

    if ($SkipMeteredSmoke) {
        Write-Host "Metered adapter smoke skipped by request."
    }
    else {
        $apiKeyPath = Join-Path `
            $env:LOCALAPPDATA `
            "Astro\staging-secrets\api_key"

        if (-not (Test-Path $apiKeyPath -PathType Leaf)) {
            throw "The protected local Astro API key file is missing."
        }

        $apiKey = (Get-Content $apiKeyPath -Raw).Trim()
        if ($apiKey.Length -lt 32) {
            throw "The protected local Astro API key file is invalid."
        }

        $env:ASTRO_API_URL = "http://127.0.0.1:8080"
        $env:ASTRO_API_KEY = $apiKey
        $env:ASTRO_TEST_CONSUMER_ID = [guid]::NewGuid().ToString()

        try {
            Write-Host "Running the real Horos-to-Astro metered adapter smoke..."
            npx --yes deno run `
                --config=./supabase/functions/horos-api/deno.json `
                --allow-env=ASTRO_API_URL,ASTRO_API_KEY,ASTRO_TEST_CONSUMER_ID,ENVIRONMENT `
                --allow-net=127.0.0.1:8080 `
                ./supabase/functions/horos-api/astro_local_smoke.ts
            Assert-ExitCode "Horos-to-Astro metered adapter smoke failed."
        }
        finally {
            Remove-Item Env:ASTRO_API_URL -ErrorAction SilentlyContinue
            Remove-Item Env:ASTRO_API_KEY -ErrorAction SilentlyContinue
            Remove-Item Env:ASTRO_TEST_CONSUMER_ID -ErrorAction SilentlyContinue
            $apiKey = $null
        }
    }

    Write-Host "Horos private-beta local preflight passed."
    Write-Host "This proves the protected local adapter path only; hosted Edge Function deployment remains a separate gate."
}
finally {
    Pop-Location
}
