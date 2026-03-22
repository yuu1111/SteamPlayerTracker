#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Steam Player Tracker - Setup"

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
	Write-Host "Error: bun is not installed" -ForegroundColor Red
	exit 1
}

bun install
if ($LASTEXITCODE -ne 0) { exit 1 }

if (-not (Test-Path ".env")) {
	if (Test-Path ".env.example") {
		Copy-Item ".env.example" ".env"
		Write-Host ".env created from template - please configure it" -ForegroundColor Yellow
	} else {
		Write-Host "Error: .env.example not found" -ForegroundColor Red
		exit 1
	}
}

bun run build
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Setup complete" -ForegroundColor Green
