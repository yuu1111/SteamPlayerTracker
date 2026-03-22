#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Steam Player Tracker"

if (-not (Test-Path ".env")) {
	Write-Host "Error: .env not found - run setup first" -ForegroundColor Red
	exit 1
}

if (-not (Test-Path "dist")) {
	Write-Host "Building..." -ForegroundColor Yellow
	bun run build
	if ($LASTEXITCODE -ne 0) { exit 1 }
}

bun run start
