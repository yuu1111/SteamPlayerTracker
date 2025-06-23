# Steam Player Tracker Build Script for PowerShell Core (pwsh)

$Host.UI.RawUI.WindowTitle = "Steam Player Tracker - Build"

Write-Host "Steam Player Tracker - Build Script" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: npm is not installed" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Install dependencies if node_modules doesn't exist
if (!(Test-Path "node_modules")) {
    Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Clean previous build
Write-Host "`nCleaning previous build..." -ForegroundColor Yellow
npm run clean

# Build the project
Write-Host "`nBuilding project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBuild completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit 1
}