<#
.SYNOPSIS
  Read-only check of the two settings that block TikTak: Anonymous sign-in
  and Google Cloud billing for Maps.

.DESCRIPTION
  Changes nothing. It reports, for each setting, whether it is already on,
  and whether YOUR account has what is needed to turn it on from the CLI.
  Fix commands are printed at the end; you run them yourself.

.NOTES
  If Windows refuses to run this with "running scripts is disabled",
  unblock it for this window only:
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#>

$ErrorActionPreference = "Continue"
$ProjectId = "shipping-1ed5b"
$ok = "[ OK ]"; $no = "[FAIL]"; $warn = "[WARN]"

function Head($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }

# ---------------------------------------------------------------- 0. gcloud
Head "0. Prerequisites"

$gcloud = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloud) {
    Write-Host "$no gcloud is not installed."
    Write-Host "      Install: https://cloud.google.com/sdk/docs/install"
    Write-Host "      Without it, NEITHER setting can be done from PowerShell."
    return
}
Write-Host "$ok gcloud found: $($gcloud.Source)"

$account = (gcloud config get-value account 2>$null)
if (-not $account -or $account -eq "(unset)") {
    Write-Host "$no Not logged in.  Run: gcloud auth login"
    return
}
Write-Host "$ok Logged in as: $account"

gcloud config set project $ProjectId 2>$null | Out-Null
Write-Host "$ok Project set to: $ProjectId"

# ------------------------------------------------------- 1. Billing / Maps
Head "1. Google Cloud billing (fixes BillingNotEnabledMapError)"

$billingEnabled = $false
$billingInfo = gcloud billing projects describe $ProjectId --format=json 2>&1
if ($LASTEXITCODE -eq 0) {
    $b = $billingInfo | ConvertFrom-Json
    $billingEnabled = [bool]$b.billingEnabled
    if ($billingEnabled) {
        Write-Host "$ok Billing is ALREADY ENABLED (account $($b.billingAccountName))."
    } else {
        Write-Host "$no Billing is NOT enabled. This is why the map is watermarked."
    }
} else {
    Write-Host "$warn Could not read billing state. You may lack permission, or"
    Write-Host "      the Cloud Billing API is off. Raw error:"
    Write-Host "      $billingInfo"
}

Write-Host ""
Write-Host "Billing accounts you can use:"
$accts = gcloud billing accounts list --format=json 2>&1
if ($LASTEXITCODE -eq 0) {
    $list = $accts | ConvertFrom-Json
    $open = @($list | Where-Object { $_.open -eq $true })
    if ($open.Count -eq 0) {
        Write-Host "$no You have NO open billing account."
        Write-Host "      >>> THIS CANNOT BE FIXED FROM POWERSHELL. <<<"
        Write-Host "      Creating a billing account needs a payment card entered"
        Write-Host "      by hand at https://console.cloud.google.com/billing"
    } else {
        foreach ($a in $open) {
            Write-Host "$ok $($a.name)  -  $($a.displayName)"
        }
    }
} else {
    Write-Host "$warn Could not list billing accounts: $accts"
}

# Maps APIs
Write-Host ""
Write-Host "Maps APIs currently enabled:"
$needed = @(
    "maps-backend.googleapis.com",
    "geocoding-backend.googleapis.com",
    "directions-backend.googleapis.com",
    "places-backend.googleapis.com"
)
$enabled = gcloud services list --enabled --project $ProjectId --format="value(config.name)" 2>&1
if ($LASTEXITCODE -eq 0) {
    foreach ($svc in $needed) {
        if (@($enabled) -contains $svc) { Write-Host "$ok $svc" }
        else                         { Write-Host "$no $svc  (not enabled)" }
    }
} else {
    Write-Host "$warn Could not list services: $enabled"
}

# ------------------------------------------------- 2. Anonymous sign-in
Head "2. Anonymous sign-in (fixes auth/admin-restricted-operation)"

$token = gcloud auth print-access-token 2>$null
if (-not $token) {
    Write-Host "$no Could not get an access token. Run: gcloud auth login"
} else {
    $headers = @{ Authorization = "Bearer $token" }
    $uri = "https://identitytoolkit.googleapis.com/admin/v2/projects/$ProjectId/config"
    try {
        $cfg = Invoke-RestMethod -Method GET -Uri $uri -Headers $headers
        $anon = $cfg.signIn.anonymous.enabled
        if ($anon -eq $true) {
            Write-Host "$ok Anonymous sign-in is ALREADY ENABLED."
            Write-Host "      If guest booking still fails, the cause is something else."
        } else {
            Write-Host "$no Anonymous sign-in is DISABLED. This is the confirmed cause"
            Write-Host "      of auth/admin-restricted-operation. It CAN be turned on"
            Write-Host "      from PowerShell - see the fix command below."
        }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "$warn Could not read the auth config (HTTP $code)."
        if ($code -eq 403) {
            Write-Host "      403 usually means either the Identity Toolkit API is off:"
            Write-Host "        gcloud services enable identitytoolkit.googleapis.com --project $ProjectId"
            Write-Host "      or your account lacks the Firebase Authentication Admin role."
        }
        Write-Host "      $($_.Exception.Message)"
    }
}

# ------------------------------------------------------------- Fix commands
Head "Fix commands (nothing above changed anything)"

Write-Host ""
Write-Host "-- Enable Anonymous sign-in --------------------------------------"
Write-Host @"
  `$t = gcloud auth print-access-token
  `$h = @{ Authorization = "Bearer `$t" }
  `$b = '{"signIn":{"anonymous":{"enabled":true}}}'
  Invoke-RestMethod -Method PATCH ``
    -Uri "https://identitytoolkit.googleapis.com/admin/v2/projects/$ProjectId/config?updateMask=signIn.anonymous.enabled" ``
    -Headers `$h -ContentType "application/json" -Body `$b
"@

Write-Host ""
Write-Host "-- Enable billing (use an account ID printed in section 1) -------"
Write-Host "  gcloud billing projects link $ProjectId --billing-account=XXXXXX-XXXXXX-XXXXXX"
Write-Host "  # Replace the X's with a REAL id from section 1. Do not paste it literally."

Write-Host ""
Write-Host "-- Enable the Maps APIs ------------------------------------------"
Write-Host "  gcloud services enable $($needed -join ' ') --project $ProjectId"

Write-Host ""
Write-Host "-- Re-run this script to confirm ---------------------------------"
Write-Host "  .\scripts\Check-ConsoleSettings.ps1"
Write-Host ""
