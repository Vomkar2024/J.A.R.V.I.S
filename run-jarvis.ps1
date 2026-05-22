param(
    [switch]$UseBuild,
    [switch]$NoBrowser
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

Write-Host "[J.A.R.V.I.S] Starting execution helper..."
Write-Host "[J.A.R.V.I.S] Root path: $root"

Write-Host "[J.A.R.V.I.S] Syncing environment variables..."
npm run sync-env

function Start-TerminalProcess {
    param(
        [string]$Name,
        [string]$Command
    )

    Write-Host "[J.A.R.V.I.S] Launching $Name..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $Command -WindowStyle Normal
}

$backendCommand = "Set-Location '$root\\backend'; .\\venv\\Scripts\\python.exe main.py"
Start-TerminalProcess -Name 'Backend (Neural AI WS server)' -Command $backendCommand

if ($UseBuild) {
    Write-Host "[J.A.R.V.I.S] Running frontend from built files..."
    $frontendCommand = "Set-Location '$root\\frontend'; serve -s build"
    Start-TerminalProcess -Name 'Frontend (static build)' -Command $frontendCommand
    Write-Host "[J.A.R.V.I.S] If the port is selected dynamically, check the serve output for the URL."
} else {
    Write-Host "[J.A.R.V.I.S] Running frontend dev server..."
    $frontendCommand = "Set-Location '$root\\frontend'; npm start"
    Start-TerminalProcess -Name 'Frontend (dev server)' -Command $frontendCommand
    if (-not $NoBrowser) {
        Start-Sleep -Seconds 5
        Write-Host "[J.A.R.V.I.S] Opening browser to http://localhost:3000"
        Start-Process "http://localhost:3000"
    }
}

Write-Host "[J.A.R.V.I.S] Execution helper launched. Backend and frontend should start in new PowerShell windows."
Write-Host "[J.A.R.V.I.S] The splash screen will display automatically when the frontend loads."
