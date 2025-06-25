# PowerShell script to sync CSV data to Google Sheets
# Syncs local CSV files with Google Sheets (sorted by timestamp)

$Host.UI.RawUI.WindowTitle = "Steam Player Tracker - Syncing Google Sheets..."

Write-Host "Steam Player Tracker - Google Sheets Sync" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

# Display PowerShell version
Write-Host "PowerShell Version: $($PSVersionTable.PSVersion)" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if npm is available
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Error: npm is not available" -ForegroundColor Red
    Write-Host "Please make sure Node.js is properly installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if package.json exists
if (-not (Test-Path "package.json")) {
    Write-Host "Error: package.json not found" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Warning: .env file not found" -ForegroundColor Yellow
    Write-Host "Please copy .env.example to .env and configure it" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Starting Google Sheets sync..." -ForegroundColor Cyan
Write-Host ""

# Run the sync command
try {
    npm run sync-google-sheets
    $exitCode = $LASTEXITCODE
    
    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "Google Sheets sync completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Google Sheets sync failed with exit code: $exitCode" -ForegroundColor Red
    }
} catch {
    Write-Host "Error running sync command: $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

$Host.UI.RawUI.WindowTitle = "Steam Player Tracker - Sync Complete"
exit $exitCode