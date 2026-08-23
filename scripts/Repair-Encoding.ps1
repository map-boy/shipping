<#
.SYNOPSIS
    Rewrites tracked text files as UTF-8 without a BOM.

.DESCRIPTION
    PowerShell's default redirection (> and >>) writes UTF-16LE on Windows
    PowerShell 5.1, and several editors add a UTF-8 BOM. Both crept into this
    repo - a BOM in firebase.json can break the Firebase CLI's JSON parse, and
    the UTF-16 tail on .gitignore made its last two rules inert.

    Run with -WhatIf first to see what would change.

.EXAMPLE
    .\scripts\Repair-Encoding.ps1 -WhatIf
    .\scripts\Repair-Encoding.ps1
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$fixed = 0

foreach ($file in (git ls-files '*.ts' '*.tsx' '*.js' '*.json' '*.html' '*.css' '*.md' '*.gitignore')) {
    if (-not (Test-Path $file)) { continue }
    $path  = (Resolve-Path $file).Path
    $bytes = [System.IO.File]::ReadAllBytes($path)
    if ($bytes.Length -eq 0) { continue }

    $text = $null

    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $text = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
        $why  = 'UTF-8 BOM'
    }
    elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
        $text = [System.Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length - 2)
        $why  = 'UTF-16LE'
    }
    elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
        $text = [System.Text.Encoding]::BigEndianUnicode.GetString($bytes, 2, $bytes.Length - 2)
        $why  = 'UTF-16BE'
    }
    elseif ($bytes -contains 0) {
        # No BOM but embedded nulls: a UTF-16 chunk appended to a UTF-8 file.
        $text = ([System.Text.Encoding]::UTF8.GetString($bytes)) -replace "`0", ''
        $why  = 'embedded null bytes'
    }

    if ($null -ne $text) {
        if ($PSCmdlet.ShouldProcess($file, "rewrite as UTF-8 (was $why)")) {
            [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
            Write-Host "  fixed ($why): $file" -ForegroundColor Green
        }
        $fixed++
    }
}

Write-Host ''
if ($fixed -eq 0) {
    Write-Host 'Nothing to fix - every tracked text file is already UTF-8 without a BOM.' -ForegroundColor Green
}
else {
    Write-Host "$fixed file(s) rewritten. Review with: git diff --stat" -ForegroundColor Cyan
}
