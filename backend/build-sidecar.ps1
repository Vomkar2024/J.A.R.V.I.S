#requires -Version 5.1
<#
.SYNOPSIS
    Compile backend\main.py into the Tauri sidecar binary.

.DESCRIPTION
    1. Resolves the venv's PyInstaller.
    2. Runs against jarvis_core.spec (clean, no-confirm).
    3. Renames dist\jarvis-core.exe → host-triple-suffixed name expected by
       Tauri's externalBin convention.
    4. Copies it to src-tauri\binaries\.

.NOTES
    Invoke from the repo root:  npm run sidecar:build
#>

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$backendRoot = $PSScriptRoot
$venvPython = Join-Path $backendRoot '.venv\Scripts\python.exe'

if (-not (Test-Path $venvPython)) {
    Write-Error "Python venv not found at $venvPython. Run 'py -3 -m venv backend\.venv' first."
}

# Detect host triple — Tauri appends this to the sidecar name on build.
$triple = (& $venvPython -c "import platform; m = platform.machine().lower(); m = 'x86_64' if m in ('amd64','x86_64') else ('aarch64' if m in ('arm64','aarch64') else m); print(f'{m}-pc-windows-msvc')").Trim()
$targetName = "jarvis-core-$triple.exe"

Write-Host "[sidecar] target = $targetName" -ForegroundColor Cyan

# Make sure PyInstaller is installed in the venv.
& $venvPython -m pip install --quiet --disable-pip-version-check pyinstaller
if ($LASTEXITCODE -ne 0) { throw "pip install pyinstaller failed" }

Push-Location $backendRoot
try {
    Write-Host "[sidecar] running PyInstaller (this takes a few minutes)..." -ForegroundColor Cyan
    & $venvPython -m PyInstaller jarvis_core.spec --clean --noconfirm
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

$built = Join-Path $backendRoot 'dist\jarvis-core.exe'
if (-not (Test-Path $built)) {
    throw "Expected output not found at $built"
}

$binDir = Join-Path $repoRoot 'src-tauri\binaries'
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

# Remove any stale copy first so Tauri picks up the new one.
Get-ChildItem -Path $binDir -Filter 'jarvis-core-*.exe' -ErrorAction SilentlyContinue |
    Remove-Item -Force

$target = Join-Path $binDir $targetName
Copy-Item -Path $built -Destination $target -Force

$size = [math]::Round((Get-Item $target).Length / 1MB, 1)
Write-Host "[sidecar] OK → $target ($size MB)" -ForegroundColor Green
