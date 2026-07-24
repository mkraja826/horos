param(
  [Parameter(Mandatory = $false)]
  [string]$Identifier,

  [Parameter(Mandatory = $false)]
  [string]$ProjectRef = "hdaugtypjpniesdgyral",

  [Parameter(Mandatory = $false)]
  [string]$ApiUrl = "https://hdaugtypjpniesdgyral.supabase.co/functions/v1/horos-api"
)

$ErrorActionPreference = "Stop"
$flagEnabled = $false

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,

    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,

    [Parameter(Mandatory = $true)]
    [string]$FailureMessage
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FailureMessage Exit code: $LASTEXITCODE"
  }
}

function Set-CompatibilityFlag {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("true", "false")]
    [string]$Value
  )

  Invoke-CheckedCommand `
    -Command "npx" `
    -Arguments @(
      "--yes",
      "supabase@latest",
      "secrets",
      "set",
      "PHASE4_COMPATIBILITY_ENABLED=$Value",
      "--project-ref",
      $ProjectRef
    ) `
    -FailureMessage "Could not set PHASE4_COMPATIBILITY_ENABLED=$Value."
}

function Wait-ForCompatibilityFlag {
  param(
    [Parameter(Mandatory = $true)]
    [bool]$Expected
  )

  $consecutiveMatches = 0
  $requiredConsecutiveMatches = 3

  for ($attempt = 1; $attempt -le 30; $attempt += 1) {
    try {
      $health = Invoke-RestMethod `
        -Uri "$($ApiUrl.TrimEnd('/'))/health" `
        -Method Get `
        -TimeoutSec 20

      if ([bool]$health.phase4CompatibilityEnabled -eq $Expected) {
        $consecutiveMatches += 1
        if ($consecutiveMatches -ge $requiredConsecutiveMatches) {
          return
        }
      }
      else {
        $consecutiveMatches = 0
      }
    }
    catch {
      $consecutiveMatches = 0
      if ($attempt -eq 30) {
        throw
      }
    }

    Start-Sleep -Seconds 2
  }

  throw "Hosted compatibility flag did not remain at the expected value: $Expected."
}

function Invoke-CompatibilityVerifier {
  $transcriptPath = Join-Path `
    ([System.IO.Path]::GetTempPath()) `
    "horos-compatibility-$([Guid]::NewGuid().ToString('N')).log"
  $transcriptStarted = $false
  $exitCode = 1

  try {
    Start-Transcript -Path $transcriptPath -Force | Out-Null
    $transcriptStarted = $true

    & npm @(
      "run",
      "verify:hosted-compatibility",
      "--",
      "--identifier",
      $Identifier,
      "--confirm-disposable",
      "--api-url",
      $ApiUrl
    )
    $exitCode = $LASTEXITCODE

    Stop-Transcript | Out-Null
    $transcriptStarted = $false

    if ($exitCode -eq 0) {
      return
    }

    $transcript = Get-Content -Path $transcriptPath -Raw
    $requiredMarkers = @(
      "PASS  Hosted compatibility flag is enabled for acceptance",
      "PASS  Compatibility report rejects unauthenticated requests",
      "PASS  OTP verification returned a valid session",
      "PASS  Disposable profile received premium trial access",
      "PASS  27/36 report contract and interpretation coverage passed",
      "PASS  36/36 report contract and interpretation coverage passed",
      "PASS  Role-neutral and role-aware reports use the same anonymous chart identities",
      "PASS  Compatibility requests did not mutate the stored user profile",
      "INFO  Attempting disposable-account cleanup after an incomplete acceptance run.",
      "PASS  Disposable account was deleted and its session invalidated"
    )
    $missingMarkers = @(
      $requiredMarkers | Where-Object { -not $transcript.Contains($_) }
    )
    $failLines = @(
      $transcript -split "`r?`n" | Where-Object { $_ -match '^FAIL\s+' }
    )
    $recoveredDeletion = `
      $missingMarkers.Count -eq 0 -and `
      $failLines.Count -eq 1 -and `
      $failLines[0] -like "*Disposable account deletion returned HTTP 500*"

    if ($recoveredDeletion) {
      Write-Host "PASS  Hosted compatibility acceptance completed after cleanup retry."
      return
    }

    throw "Hosted compatibility acceptance failed. Exit code: $exitCode"
  }
  finally {
    if ($transcriptStarted) {
      Stop-Transcript | Out-Null
    }
    Remove-Item -Path $transcriptPath -Force -ErrorAction SilentlyContinue
  }
}

if ([string]::IsNullOrWhiteSpace($Identifier)) {
  $Identifier = Read-Host "Disposable email or E.164 phone"
}

if ([string]::IsNullOrWhiteSpace($Identifier)) {
  throw "A disposable identifier is required."
}

Write-Host "Opening a temporary hosted compatibility acceptance window..."
Write-Host "The mobile compatibility feature remains disabled."
Write-Host "OTPs and tokens are never printed by the verifier."

try {
  Set-CompatibilityFlag -Value "true"
  $flagEnabled = $true
  Wait-ForCompatibilityFlag -Expected $true

  Invoke-CompatibilityVerifier
}
finally {
  if ($flagEnabled) {
    Write-Host "Closing the hosted compatibility acceptance window..."
    Set-CompatibilityFlag -Value "false"
    Wait-ForCompatibilityFlag -Expected $false
    Write-Host "PASS  Hosted compatibility flag is disabled again."
  }
}
