# Steam Player Tracker Start Script for PowerShell Core (pwsh)

$Host.UI.RawUI.WindowTitle = "Steam Player Tracker - Running"

Write-Host "Steam Player Tracker - Start Script" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Check if .env file exists
if (!(Test-Path ".env")) {
    Write-Host "Error: .env file not found" -ForegroundColor Red
    Write-Host "Please create a .env file based on .env.example" -ForegroundColor Yellow
    exit 1
}

# Check if dist folder exists
if (!(Test-Path "dist")) {
    Write-Host "Build not found. Running build script..." -ForegroundColor Yellow
    & .\build.ps1
    if ($LASTEXITCODE -ne 0) {
        exit 1
    }
}

# Start the application
Write-Host "`nStarting Steam Player Tracker..." -ForegroundColor Green
npm start

# Keep window open if there was an error
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nPress any key to exit..." -ForegroundColor Red
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}