#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Steam Player Tracker - Sync"

bun run sync-google-sheets
