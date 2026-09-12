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
    # x-goog-user-project is required for user credentials: without it Google
    # bills the call to the gcloud CLI's own project and answers 403.
    $headers = @{
        Authorization       = "Bearer $token"
        "x-goog-user-project" = $ProjectId
    }
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

        # PowerShell hides the response body, which is where Google explains
        # itself. Read it directly or we are guessing at the cause.
        $body = ""
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $stream.Position = 0
            $body = (New-Object System.IO.StreamReader($stream)).ReadToEnd()
        } catch { $body = $_.ErrorDetails.Message }
        if ($body) { Write-Host "      Google said: $body" }

        if ($code -eq 403) {
            Write-Host ""
            Write-Host "      Check whether you hold a role that can change auth config:"
            Write-Host "        gcloud projects get-iam-policy $ProjectId ``"
            Write-Host "          --flatten='bindings[].members' ``"
            Write-Host "          --filter='bindings.members:$account' ``"
            Write-Host "          --format='value(bindings.role)'"
            Write-Host "      You need roles/owner or roles/firebaseauth.admin."
            Write-Host ""
            Write-Host "      If you do NOT hold one, the CLI cannot do this. Use the console:"
            Write-Host "        https://console.firebase.google.com/project/$ProjectId/authentication/providers"
        }
    }
}

# ------------------------------------------------------------ 3. Budget
Head "3. Budget alerts (email warning when spend reaches a limit)"

Write-Host "NOTE: a budget alert only EMAILS you. It does NOT stop spending."
Write-Host "      To actually cap usage, set per-API quota limits (link at the end)."
Write-Host ""

$billingAcct = ""
if ($billingEnabled) {
    $bi = gcloud billing projects describe $ProjectId --format="value(billingAccountName)" 2>$null
    if ($bi) { $billingAcct = ($bi -replace "billingAccounts/", "") }
}

if (-not $billingAcct) {
    Write-Host "$warn No billing account linked, so no budget to check."
} else {
    # Let gcloud do the formatting. PowerShell 5.1 hands ConvertFrom-Json a
    # JSON array as ONE object, so parsing it here printed every budget's
    # fields concatenated into a single unreadable line.
    $names = @(gcloud billing budgets list --billing-account=$billingAcct --format="value(displayName)" 2>&1)
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$warn Could not list budgets. The API may be off:"
        Write-Host "        gcloud services enable billingbudgets.googleapis.com --project $ProjectId"
    } elseif ($names.Count -eq 0 -or ($names -join "").Trim() -eq "") {
        Write-Host "$no NO budget alert is set. You will not be warned about charges."
    } else {
        Write-Host "Budgets on this billing account (it may cover several projects):"
        gcloud billing budgets list --billing-account=$billingAcct --format="table(
            displayName:label=NAME,
            amount.specifiedAmount.units:label=AMOUNT,
            amount.specifiedAmount.currencyCode:label=CUR,
            budgetFilter.projects.list():label=APPLIES_TO)"

        # Two budgets with one name is almost always an accidental re-run.
        $dupes = @($names | Group-Object | Where-Object { $_.Count -gt 1 })
        if ($dupes.Count -gt 0) {
            Write-Host ""
            foreach ($d in $dupes) {
                Write-Host "$warn DUPLICATE: '$($d.Name)' exists $($d.Count) times."
            }
            Write-Host "      Delete the extras - each one emails you separately:"
            Write-Host "        gcloud billing budgets list --billing-account=$billingAcct --format='value(name)'"
            Write-Host "        gcloud billing budgets delete BUDGET_ID --billing-account=$billingAcct"
        }
    }
}

# ------------------------------------------------------------- Fix commands
Head "Fix commands (nothing above changed anything)"

Write-Host ""
Write-Host "-- Enable Anonymous sign-in --------------------------------------"
Write-Host @"
  `$t = gcloud auth print-access-token
  `$h = @{ Authorization = "Bearer `$t"; "x-goog-user-project" = "$ProjectId" }
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
Write-Host "-- Set a 1 USD budget alert --------------------------------------"
Write-Host "  gcloud services enable billingbudgets.googleapis.com --project $ProjectId"
Write-Host "  gcloud billing budgets create --billing-account=$billingAcct ``"
Write-Host "    --display-name='TikTak 1 USD alert' --budget-amount=1USD ``"
Write-Host "    --filter-projects='projects/$ProjectId' ``"
Write-Host "    --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0"

Write-Host ""
Write-Host "-- Hard caps that actually STOP spending (console) ----------------"
Write-Host "  https://console.cloud.google.com/apis/api/geocoding-backend.googleapis.com/quotas?project=$ProjectId"
Write-Host "  https://console.cloud.google.com/apis/credentials?project=$ProjectId  (restrict the API key)"

Write-Host ""
Write-Host "-- Re-run this script to confirm ---------------------------------"
Write-Host "  .\scripts\Check-ConsoleSettings.ps1"
Write-Host ""
