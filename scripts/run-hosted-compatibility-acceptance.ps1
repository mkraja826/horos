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

  for ($attempt = 1; $attempt -le 15; $attempt += 1) {
    try {
      $health = Invoke-RestMethod `
        -Uri "$($ApiUrl.TrimEnd('/'))/health" `
        -Method Get `
        -TimeoutSec 20

      if ([bool]$health.phase4CompatibilityEnabled -eq $Expected) {
        return
      }
    }
    catch {
      if ($attempt -eq 15) {
        throw
      }
    }

    Start-Sleep -Seconds 2
  }

  throw "Hosted compatibility flag did not reach the expected value: $Expected."
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

  Invoke-CheckedCommand `
    -Command "npm" `
    -Arguments @(
      "run",
      "verify:hosted-compatibility",
      "--",
      "--identifier",
      $Identifier,
      "--confirm-disposable",
      "--api-url",
      $ApiUrl
    ) `
    -FailureMessage "Hosted compatibility acceptance failed."
}
finally {
  if ($flagEnabled) {
    Write-Host "Closing the hosted compatibility acceptance window..."
    Set-CompatibilityFlag -Value "false"
    Wait-ForCompatibilityFlag -Expected $false
    Write-Host "PASS  Hosted compatibility flag is disabled again."
  }
}
