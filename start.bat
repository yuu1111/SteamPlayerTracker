@echo off
REM Steam Player Tracker Start Script for Windows

title Steam Player Tracker - Starting...

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

REM Run PowerShell script with execution policy bypass
pwsh -ExecutionPolicy Bypass -File start.ps1

REM Keep window open
echo.
if %ERRORLEVEL% neq 0 (
    echo "Application stopped with error! Press any key to exit..."
) else (
    echo "Application stopped! Press any key to exit..."
)
pause > nul