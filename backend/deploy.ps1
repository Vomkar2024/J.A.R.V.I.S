# J.A.R.V.I.S Nexus Deployment Script
# This script deploys the project to your local Nexus Repository Manager

Write-Host "Initializing Neural Uplink to Nexus..." -ForegroundColor Cyan

# Ensure you have Maven installed
if (!(Get-Command mvn -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Maven (mvn) not found in PATH." -ForegroundColor Red
    exit 1
}

# Run the deployment using the local settings.xml
mvn deploy -s settings.xml

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment Successful. Data synchronized with Nexus." -ForegroundColor Green
} else {
    Write-Host "Deployment Failed. Check Nexus connectivity and credentials." -ForegroundColor Red
}
