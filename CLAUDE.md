# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**言語**: このリポジトリで作業する際は、ユーザーとのコミュニケーションは日本語で行ってください。

## Development Commands

```bash
# Build and run
npm run build              # Compile TypeScript to dist/
npm start                  # Run compiled application
npm run dev                # Run in development mode with ts-node

# Development tools
npm run watch              # Watch mode compilation
npm run clean              # Clean dist directory
npm run lint               # ESLint static analysis
npm run typecheck          # TypeScript type checking
npm run calculate-daily-averages  # Manual daily average calculation tool

# Platform-specific scripts
# Windows: build.bat, start.bat, setup.bat
# Windows (PowerShell): build.ps1, start.ps1, setup.ps1  
# Linux/macOS: build.sh, start.sh, setup.sh
```

## Architecture Overview

**Main Class**: `SteamPlayerTracker` (src/steamPlayerTracker.ts) - Central coordinator that orchestrates all services

**Service-Oriented Design**:
- `SteamApiService`: Fetches current player counts from Steam Web API
- `CsvWriter`: Handles CSV file operations for data persistence
- `GoogleSheetsService`: Optional Google Sheets integration for cloud storage
- `DailyAverageService`: Calculates and manages daily player count averages
- `Scheduler`: Manages cron-based data collection and daily calculations
- `RetryHandler`: Implements exponential backoff retry logic
- `Logger`: Winston-based logging with file rotation

**Data Flow**: Steam API → Data Collection → Parallel Storage (CSV + Google Sheets) → Daily Average Calculation

## Configuration System

Configuration is environment-based using dotenv with validation in `src/config/config.ts`:

**Required**: Copy `.env.example` to `.env` and configure:
- `STEAM_APP_ID`: Steam game App ID to track
- `COLLECTION_MINUTES`: Comma-separated minutes for data collection (e.g., "0,30")
- `DAILY_AVERAGE_HOUR`: Hour (0-23) for daily average calculation

**Optional Google Sheets Integration**:
- Set `GOOGLE_SHEETS_ENABLED=true`
- Configure `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`
- Requires Google Cloud service account with Sheets API access

## Key Implementation Details

**Error Handling**: Steam API returns 0 players are treated as failed requests and trigger retries

**Startup Behavior**:
1. Immediate data collection on startup
2. Validation of Steam API connectivity  
3. Check and calculate missing daily averages
4. Schedule ongoing collection and daily calculations

**File Structure**:
- `src/index.ts`: Application entry point
- `src/config/`: Configuration management and validation
- `src/services/`: All business logic services
- `src/types/`: TypeScript type definitions
- `src/utils/`: Shared utilities (logging, retry logic)
- `src/tools/`: Command-line utilities

**Data Storage**: 
- CSV files with timestamp,player_count format
- Daily averages exclude zero values (API failures)
- Google Sheets mirrors CSV structure in separate sheets