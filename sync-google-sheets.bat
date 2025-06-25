@echo off
REM Batch script to run sync-google-sheets.ps1
REM Syncs local CSV files with Google Sheets (sorted by timestamp)

title "Steam Player Tracker - Syncing Google Sheets..."

echo "Steam Player Tracker - Google Sheets Sync"
echo "========================================="
echo.

REM Check if PowerShell is available
where powershell >nul 2>nul
if %errorlevel% neq 0 (
    echo "Error: PowerShell is not installed or not in PATH"
    echo "Please install PowerShell or use Windows PowerShell"
    echo.
    pause
    exit /b 1
)

REM Check if sync-google-sheets.ps1 exists
if not exist "sync-google-sheets.ps1" (
    echo "Error: sync-google-sheets.ps1 not found"
    echo "Please run this script from the project root directory"
    echo.
    pause
    exit /b 1
)

echo "Running PowerShell script..."
echo.

REM Execute the PowerShell script with execution policy bypass
powershell.exe -ExecutionPolicy Bypass -File "sync-google-sheets.ps1"

REM Capture exit code
set exit_code=%errorlevel%

echo.
if %exit_code% equ 0 (
    echo "Batch script completed successfully!"
) else (
    echo "Batch script failed with exit code: %exit_code%"
)

title "Steam Player Tracker - Sync Complete"
pause
exit /b %exit_code%