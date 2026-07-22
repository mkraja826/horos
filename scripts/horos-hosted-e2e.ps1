[CmdletBinding()]
param(
    [string]$Identifier,
    [string]$ProfilePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ApiUrl = "https://hdaugtypjpniesdgyral.supabase.co/functions/v1/horos-api"

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = @{},
        [object]$Body
    )

    $parameters = @{
        Uri         = "$ApiUrl$Path"
        Method      = $Method
        Headers     = $Headers
        ContentType = "application/json"
    }

    if ($null -ne $Body) {
        $parameters.Body = $Body | ConvertTo-Json -Depth 10
    }

    try {
        $response = Invoke-WebRequest @parameters -UseBasicParsing
        return @{
            Status = [int]$response.StatusCode
            Body   = $response.Content | ConvertFrom-Json
        }
    }
    catch {
        if (-not $_.Exception.Response) { throw }

        $status = [int]$_.Exception.Response.StatusCode
        $reader = [System.IO.StreamReader]::new(
            $_.Exception.Response.GetResponseStream()
        )

        $content = $reader.ReadToEnd()
        $reader.Dispose()

        $parsed = if ($content) {
            $content | ConvertFrom-Json
        } else {
            $null
        }

        return @{ Status = $status; Body = $parsed }
    }
}

Write-Host "Horos hosted E2E"
Write-Host "API: $ApiUrl"

$health = Invoke-Api -Method GET -Path "/health"
if ($health.Status -ne 200 -or $health.Body.status -ne "ok") {
    throw "Health check failed."
}
Write-Host "Health=PASS"

$protected = Invoke-Api -Method GET -Path "/subscription/status"
if ($protected.Status -ne 401) {
    throw "Protected route returned $($protected.Status), expected 401."
}
Write-Host "ProtectedRoute=PASS"

$invalidRefresh = Invoke-Api -Method POST -Path "/auth/refresh" -Body @{}
if ($invalidRefresh.Status -ne 400) {
    throw "Invalid refresh returned $($invalidRefresh.Status), expected 400."
}
Write-Host "InvalidRefresh=PASS"

if (-not $Identifier) {
    Write-Host "Anonymous hosted checks=PASS"
    Write-Host "OTP flow skipped. Supply -Identifier to run authenticated E2E."
    exit 0
}

$otpRequest = Invoke-Api -Method POST -Path "/auth/login" -Body @{
    identifier = $Identifier
}

if ($otpRequest.Status -ne 200 -or -not $otpRequest.Body.requiresOtp) {
    throw "OTP request failed with status $($otpRequest.Status)."
}
Write-Host "OtpDelivery=PASS"

$Otp = Read-Host "Enter the six-digit OTP"
if ($Otp -notmatch '^\d{6}$') {
    throw "OTP must contain exactly six digits."
}

$login = Invoke-Api -Method POST -Path "/auth/login" -Body @{
    identifier = $Identifier
    otp        = $Otp
}

if ($login.Status -ne 200 -or -not $login.Body.token) {
    throw "OTP verification failed with status $($login.Status)."
}
Write-Host "OtpVerification=PASS"

$authorization = @{
    Authorization = "Bearer $($login.Body.token)"
}

$authenticated = Invoke-Api `
    -Method GET `
    -Path "/subscription/status" `
    -Headers $authorization

if ($authenticated.Status -ne 200) {
    throw "Authenticated route failed with status $($authenticated.Status)."
}
Write-Host "AuthenticatedRoute=PASS"

$refresh = Invoke-Api -Method POST -Path "/auth/refresh" -Body @{
    refreshToken = $login.Body.refreshToken
}

if ($refresh.Status -ne 200 -or -not $refresh.Body.token) {
    throw "Valid session refresh failed with status $($refresh.Status)."
}
Write-Host "ValidRefresh=PASS"

if ($ProfilePath) {
    if (-not (Test-Path -LiteralPath $ProfilePath -PathType Leaf)) {
        throw "Profile file does not exist: $ProfilePath"
    }

    try {
        $profileInput = Get-Content -LiteralPath $ProfilePath -Raw | ConvertFrom-Json
    }
    catch {
        throw "Profile file must contain valid JSON: $($_.Exception.Message)"
    }

    $requiredProfileFields = @(
        "fullName",
        "language",
        "notificationTime",
        "dateOfBirth",
        "timeOfBirth",
        "birthPlace",
        "timezone",
        "latitude",
        "longitude"
    )
    foreach ($field in $requiredProfileFields) {
        if ($null -eq $profileInput.$field -or "$($profileInput.$field)".Trim().Length -eq 0) {
            throw "Profile file is missing required field: $field"
        }
    }

    Write-Warning "This will create or update a REAL production profile and claim its Horos trial."
    $confirmation = Read-Host "Type CREATE to continue"
    if ($confirmation -cne "CREATE") {
        throw "Real profile flow cancelled."
    }

    $profileResult = Invoke-Api `
        -Method POST `
        -Path "/profile/create" `
        -Headers $authorization `
        -Body $profileInput

    if ($profileResult.Status -ne 201) {
        $details = $profileResult.Body | ConvertTo-Json -Depth 10 -Compress
        throw "Profile creation failed: HTTP $($profileResult.Status) $details"
    }
    Write-Host "RealProfileCreate=PASS"

    $profile = Invoke-Api `
        -Method GET `
        -Path "/profile/me" `
        -Headers $authorization

    if ($profile.Status -ne 200 -or -not $profile.Body.profile) {
        $details = $profile.Body | ConvertTo-Json -Depth 10 -Compress
        throw "Stored profile verification failed: HTTP $($profile.Status) $details"
    }
    Write-Host "RealProfileRead=PASS"

    $subscription = Invoke-Api `
        -Method GET `
        -Path "/subscription/status" `
        -Headers $authorization

    if ($subscription.Status -ne 200) {
        throw "Subscription/trial status failed with HTTP $($subscription.Status)."
    }
    Write-Host "TrialStatus=PASS"

    $horoscope = Invoke-Api `
        -Method GET `
        -Path "/horoscope/daily" `
        -Headers $authorization

    if ($horoscope.Status -ne 200 -or $null -eq $horoscope.Body) {
        $details = $horoscope.Body | ConvertTo-Json -Depth 10 -Compress
        throw "Daily horoscope failed: HTTP $($horoscope.Status) $details"
    }
    Write-Host "DailyHoroscope=PASS"
    Write-Host "HOROS_REAL_USER_FLOW=PASS"
}

Write-Host "HOROS_HOSTED_E2E=PASS"
