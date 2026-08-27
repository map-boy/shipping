<#
.SYNOPSIS
    Deploys TikTak to Firebase in the order that keeps the app consistent.

.DESCRIPTION
    Rules go first so the tightened permissions are live before the functions
    that depend on them. Functions go next, hosting last, because the new client
    calls acceptTrip/startTrip/cancelTrip - shipping the client first would leave
    riders and drivers calling functions that do not exist yet.

    Refuses to deploy unless every gate in Sync-And-Verify passes.

.EXAMPLE
    .\scripts\Deploy.ps1 -SetSecrets      # first deploy: prompts for each secret
    .\scripts\Deploy.ps1                  # subsequent deploys
    .\scripts\Deploy.ps1 -Only rules
#>
[CmdletBinding()]
param(
    [ValidateSet('all', 'rules', 'functions', 'hosting')]
    [string] $Only = 'all',
    [switch] $SetSecrets,
    [switch] $SkipVerify
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Write-Step {
    param([string] $Text)
    Write-Host ''
    Write-Host "==> $Text" -ForegroundColor Cyan
}

# --- firebase CLI present? -------------------------------------------------
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host 'The Firebase CLI is not on PATH. Install it with:' -ForegroundColor Red
    Write-Host '  npm install -g firebase-tools' -ForegroundColor Yellow
    exit 1
}

# --- verify before touching production -------------------------------------
if (-not $SkipVerify) {
    Write-Step 'Running all gates before deploy'
    & (Join-Path $PSScriptRoot 'Sync-And-Verify.ps1') -SkipPull
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Gates failed. Nothing was deployed.' -ForegroundColor Red
        exit 1
    }
}

# --- secrets ---------------------------------------------------------------
# The admin callables fail closed when these are unset, so an unconfigured
# deploy is safe but non-functional. Set them once, then re-run without the flag.
if ($SetSecrets) {
    Write-Step 'Setting Cloud Functions secrets'
    foreach ($secret in @(
        'ADMIN_USERNAME', 'ADMIN_PASSWORD',
        'MOMO_API_USER', 'MOMO_API_KEY', 'MOMO_SUBSCRIPTION_KEY'
    )) {
        Write-Host "  $secret" -ForegroundColor Gray
        firebase functions:secrets:set $secret
        if ($LASTEXITCODE -ne 0) { throw "Failed to set $secret" }
    }
}

# --- deploy in dependency order --------------------------------------------
$targets = switch ($Only) {
    'all'       { @('database', 'functions', 'hosting') }
    'rules'     { @('database') }
    'functions' { @('functions') }
    'hosting'   { @('hosting') }
}

foreach ($target in $targets) {
    Write-Step "Deploying $target"
    firebase deploy --only $target
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Deploy of '$target' failed. Later targets were skipped." -ForegroundColor Red
        exit 1
    }
}

Write-Host ''
Write-Host 'Deploy complete.' -ForegroundColor Green
Write-Host 'Smoke test:' -ForegroundColor Gray
Write-Host '  1. Sign in as a driver on /driver, go online, pick a vehicle class.' -ForegroundColor Gray
Write-Host '  2. As a rider, drag the map to set a destination and book Express.' -ForegroundColor Gray
Write-Host '  3. The offer should reach that one driver only, with a 20s countdown.' -ForegroundColor Gray
Write-Host '  4. Accept, mark arrived, start, pay, complete.' -ForegroundColor Gray
Write-Host '  5. Check tripHistory and receipts for both accounts.' -ForegroundColor Gray
Write-Host ''
Write-Host 'Reminder: schedule adminDispatchSweep, or first/second class jobs never' -ForegroundColor Yellow
Write-Host 'get dispatched and stale express requests are never cleared.' -ForegroundColor Yellow
