# Steam Player Tracker Setup Script for PowerShell Core (pwsh)

$Host.UI.RawUI.WindowTitle = "Steam Player Tracker - Setup"

Write-Host "Steam Player Tracker - Setup Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: npm is not installed" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "`nPress any key to exit..." -ForegroundColor Red
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
    Write-Host "`nPress any key to exit..." -ForegroundColor Red
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if .env file exists
if (!(Test-Path ".env")) {
    Write-Host "`nCreating .env file from template..." -ForegroundColor Yellow
    
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host ".env file created successfully" -ForegroundColor Green
        Write-Host "`nPlease edit the .env file to configure your settings:" -ForegroundColor Yellow
        Write-Host "- Set STEAM_APP_ID to your desired game's App ID" -ForegroundColor White
        Write-Host "- Configure Google Sheets settings if needed" -ForegroundColor White
        Write-Host "- Adjust collection schedule and file paths as needed" -ForegroundColor White
    } else {
        Write-Host "Error: .env.example file not found" -ForegroundColor Red
        Write-Host "`nPress any key to exit..." -ForegroundColor Red
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
} else {
    Write-Host "`n.env file already exists - skipping creation" -ForegroundColor Green
}

# Create logs directory if it doesn't exist
if (!(Test-Path "logs")) {
    Write-Host "`nCreating logs directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Name "logs" | Out-Null
    Write-Host "Logs directory created" -ForegroundColor Green
} else {
    Write-Host "`nLogs directory already exists" -ForegroundColor Green
}

# Build the project
Write-Host "`nBuilding project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSetup completed successfully!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "1. Edit .env file to configure your settings" -ForegroundColor White
    Write-Host "2. Run start.bat to start the tracker" -ForegroundColor White
    Write-Host "3. Check logs/steam-tracker.log for operation logs" -ForegroundColor White
} else {
    Write-Host "`nBuild failed!" -ForegroundColor Red
}

Write-Host "`nPress any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")