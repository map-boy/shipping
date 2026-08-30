<#
.SYNOPSIS
    Pulls the audited branch, reinstalls dependencies, and runs every gate the
    project has: typecheck, lint, production build, and the Cloud Functions build.

.DESCRIPTION
    Run this from anywhere. It resolves the repo root from its own location.
    Nothing here deploys or touches your Firebase project - it only verifies.

.EXAMPLE
    .\scripts\Sync-And-Verify.ps1
    .\scripts\Sync-And-Verify.ps1 -SkipPull
#>
[CmdletBinding()]
param(
    [string] $Branch = 'claude/laughing-lamport-rf3efi',
    [switch] $SkipPull
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$failures = New-Object System.Collections.Generic.List[string]

function Write-Step {
    param([string] $Text)
    Write-Host ''
    Write-Host "==> $Text" -ForegroundColor Cyan
}

function Invoke-Gate {
    param(
        [string]   $Name,
        [scriptblock] $Action
    )
    Write-Step $Name
    & $Action
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED: $Name" -ForegroundColor Red
        $failures.Add($Name)
    }
    else {
        Write-Host "OK: $Name" -ForegroundColor Green
    }
}

# --- 1. get the fixed code -------------------------------------------------
if (-not $SkipPull) {
    Write-Step "Fetching $Branch"
    git fetch origin $Branch
    if ($LASTEXITCODE -ne 0) { throw "git fetch failed. Check your network or credentials." }

    $dirty = git status --porcelain
    if ($dirty) {
        Write-Host 'You have uncommitted local changes:' -ForegroundColor Yellow
        git status --short
        Write-Host 'Stashing them so the pull is clean. Recover later with: git stash pop' -ForegroundColor Yellow
        git stash push -u -m "pre-audit-sync $(Get-Date -Format s)"
    }

    git checkout $Branch
    git pull origin $Branch
    if ($LASTEXITCODE -ne 0) { throw "git pull failed." }
}

# --- 2. environment sanity -------------------------------------------------
Write-Step 'Checking environment files'
foreach ($pair in @(
    @{ Real = '.env.local';         Sample = '.env.example' },
    @{ Real = 'functions\.env';     Sample = 'functions\.env.example' }
)) {
    if (Test-Path $pair.Real) {
        Write-Host ("  present: " + $pair.Real) -ForegroundColor Green
    }
    else {
        Write-Host ("  MISSING: " + $pair.Real + "  (copy from " + $pair.Sample + ")") -ForegroundColor Yellow
    }
}

if (Test-Path '.env.local') {
    $required = @(
        'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_DATABASE_URL', 'VITE_FIREBASE_APP_ID', 'VITE_GOOGLE_MAPS_API_KEY'
    )
    $content = Get-Content '.env.local' -Raw
    foreach ($key in $required) {
        if ($content -notmatch "(?m)^\s*$key\s*=\s*\S") {
            Write-Host "  $key is empty or missing in .env.local" -ForegroundColor Yellow
        }
    }
}

# --- 3. no BOMs or UTF-16 crept back in ------------------------------------
Write-Step 'Checking file encodings'
$bom = @()
foreach ($file in (git ls-files '*.ts' '*.tsx' '*.js' '*.json' '*.html' '*.css' '*.md')) {
    if (-not (Test-Path $file)) { continue }
    $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $file).Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $bom += $file
    }
    elseif ($bytes.Length -ge 2 -and (($bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) -or ($bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF))) {
        $bom += "$file (UTF-16)"
    }
}
if ($bom.Count -gt 0) {
    Write-Host '  Files with a BOM / UTF-16 encoding:' -ForegroundColor Yellow
    $bom | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
    Write-Host '  Fix with: .\scripts\Repair-Encoding.ps1' -ForegroundColor Yellow
}
else {
    Write-Host '  All tracked text files are clean UTF-8' -ForegroundColor Green
}

# --- 4. install + gates ----------------------------------------------------
Invoke-Gate 'npm install (web)'        { npm install --no-fund --no-audit }
Invoke-Gate 'npm install (functions)'  { npm install --prefix functions --no-fund --no-audit }
Invoke-Gate 'TypeScript (web)'         { npm run typecheck }
Invoke-Gate 'ESLint'                   { npm run lint }
Invoke-Gate 'Production build'         { npm run build }
Invoke-Gate 'TypeScript (functions)'   { npm --prefix functions run typecheck }

# --- 5. verdict ------------------------------------------------------------
Write-Host ''
Write-Host '--------------------------------------------------' -ForegroundColor DarkGray
if ($failures.Count -eq 0) {
    Write-Host 'ALL GATES PASSED - safe to deploy' -ForegroundColor Green
    Write-Host 'Next: .\scripts\Deploy.ps1' -ForegroundColor Gray
    exit 0
}
else {
    Write-Host "FAILED GATES ($($failures.Count)):" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
