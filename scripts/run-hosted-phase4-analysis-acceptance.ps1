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
    [Parameter(Mandatory = $true)] [string]$Command,
    [Parameter(Mandatory = $true)] [string[]]$Arguments,
    [Parameter(Mandatory = $true)] [string]$FailureMessage
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FailureMessage Exit code: $LASTEXITCODE"
  }
}

function Set-AnalysisFlag {
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
      "PHASE4_ANALYSIS_ENABLED=$Value",
      "--project-ref",
      $ProjectRef
    ) `
    -FailureMessage "Could not set PHASE4_ANALYSIS_ENABLED=$Value."
}

function Wait-ForAnalysisFlag {
  param(
    [Parameter(Mandatory = $true)]
    [bool]$Expected
  )

  $consecutiveMatches = 0
  for ($attempt = 1; $attempt -le 30; $attempt += 1) {
    try {
      $health = Invoke-RestMethod `
        -Uri "$($ApiUrl.TrimEnd('/'))/health" `
        -Method Get `
        -TimeoutSec 20

      if ([bool]$health.phase4AnalysisEnabled -eq $Expected) {
        $consecutiveMatches += 1
        if ($consecutiveMatches -ge 3) {
          return
        }
      }
      else {
        $consecutiveMatches = 0
      }
    }
    catch {
      $consecutiveMatches = 0
      if ($attempt -eq 30) { throw }
    }

    Start-Sleep -Seconds 2
  }

  throw "Hosted Phase 4 analysis flag did not remain at the expected value: $Expected."
}

if ([string]::IsNullOrWhiteSpace($Identifier)) {
  $Identifier = Read-Host "Disposable email or E.164 phone"
}
if ([string]::IsNullOrWhiteSpace($Identifier)) {
  throw "A disposable identifier is required."
}

Write-Host "Opening a temporary hosted Phase 4 analysis acceptance window..."
Write-Host "The mobile Phase 4 analysis feature remains disabled."
Write-Host "OTPs and tokens are never printed by the verifier."

try {
  Set-AnalysisFlag -Value "true"
  $flagEnabled = $true
  Wait-ForAnalysisFlag -Expected $true

  Invoke-CheckedCommand `
    -Command "npm" `
    -Arguments @(
      "run",
      "verify:hosted-phase4-analysis",
      "--",
      "--identifier",
      $Identifier,
      "--confirm-disposable",
      "--api-url",
      $ApiUrl
    ) `
    -FailureMessage "Hosted Phase 4 analysis acceptance failed."
}
finally {
  if ($flagEnabled) {
    Write-Host "Closing the hosted Phase 4 analysis acceptance window..."
    Set-AnalysisFlag -Value "false"
    Wait-ForAnalysisFlag -Expected $false
    Write-Host "PASS  Hosted Phase 4 analysis flag is disabled again."
  }
}
