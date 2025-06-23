@echo off
REM Steam Player Tracker Setup Script for Windows

title Steam Player Tracker - Setup

REM Check if pwsh is installed
where pwsh >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo "Error: PowerShell Core (pwsh) is not installed"
    echo "Please install PowerShell from https://aka.ms/PSWindows"
    echo.
    echo "Press any key to exit..."
    pause > nul
    exit /b 1
)

REM Run PowerShell setup script
pwsh -ExecutionPolicy Bypass -File setup.ps1

REM Keep window open
echo.
if %ERRORLEVEL% neq 0 (
    echo "Setup failed! Press any key to exit..."
) else (
    echo "Setup completed! Press any key to exit..."
)
pause > nul