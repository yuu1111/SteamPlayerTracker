@echo off
REM Steam Player Tracker Build Script for Windows

title Steam Player Tracker - Building...

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
pwsh -ExecutionPolicy Bypass -File build.ps1

REM Keep window open
echo.
if %ERRORLEVEL% neq 0 (
    echo "Build failed! Press any key to exit..."
) else (
    echo "Build completed! Press any key to exit..."
)
pause > nul