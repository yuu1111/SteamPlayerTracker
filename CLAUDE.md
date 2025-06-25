# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Language**: When working in this repository, communicate with users in Japanese. Keep this CLAUDE.md file in English.

**Documentation Synchronization**: 
- **IMPORTANT**: This repository contains a Japanese version of this documentation in `仕様書.md`
- Whenever this CLAUDE.md file is modified, you MUST also update `仕様書.md` to maintain synchronization
- The Japanese version should reflect all changes made to the English CLAUDE.md file
- Both files serve the same purpose but in different languages for accessibility

**Git Operations**: 
- ALWAYS ask for explicit user confirmation before running any git commit or git push commands
- Never commit or push changes without user approval, even if the user asks to "complete the task" or similar
- When ready to commit, present a summary of changes and ask: "これらの変更をコミット・プッシュしてもよろしいですか？"

**Commit Message Format**: Use conventional commit format with appropriate prefixes:
- `feat:` for new features
- `fix:` for bug fixes  
- `docs:` for documentation updates
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for adding tests
- `chore:` for maintenance tasks

Example: `feat: add automated release system` or `fix: resolve ESLint warnings`

**Commit Organization**: 
- When multiple files are changed, split commits logically by functionality or purpose
- Avoid large monolithic commits that combine unrelated changes
- Group related file changes together (e.g., source code + tests, documentation updates, configuration changes)
- Separate functional changes from documentation/formatting changes
- Each commit should represent a single logical unit of work
- **IMPORTANT**: Always divide implementation work into logical commits and push separately:
  - Core functionality changes (services, business logic)
  - Configuration and setup changes
  - Platform-specific scripts (.ps1, .sh, .bat files)
  - Documentation updates
  - Each commit should have a clear, focused purpose and be pushed immediately after completion

**Release Management**: 
- When creating releases, always update CHANGELOG.md and CHANGELOG-JP.md with proper version numbers
- **Use placeholder format "## [X.X.X] - YYYY-MM-DD JST"** for unreleased changes instead of "Unreleased"
- Replace X.X.X with actual version number only when creating the release
- Determine the version number based on the type of changes (patch/minor/major) during release process
- Ensure CHANGELOGs use placeholder format until official release
- Use conventional commit format for release commits and feature commits
- **IMPORTANT**: All dates in CHANGELOGs must be in JST (Japan Standard Time) format
- Date format: "YYYY-MM-DD JST" (e.g., "2025-06-24 JST")

**Release Process Workflow**:
1. **Complete all development work** and ensure all commits are pushed
2. **Run automated release command**:
   ```bash
   npm run release          # Patch release (1.0.0 → 1.0.1)
   npm run release:minor    # Minor release (1.0.0 → 1.1.0) 
   npm run release:major    # Major release (1.0.0 → 2.0.0)
   ```
   This automatically:
   - Cleans dependencies and rebuilds
   - Runs type checking and linting
   - Updates package.json version
   - Creates release commit and Git tag
3. **Update CHANGELOG placeholders** to actual version and JST date:
   - Replace "## [X.X.X] - YYYY-MM-DD JST" → "## [1.2.0] - 2025-06-25 JST"
   - Update both CHANGELOG.md and CHANGELOG-JP.md
4. **Update README documentation** if new features were added:
   - Update feature lists, usage examples, and command references
   - Ensure both README.md and README-JP.md are synchronized
5. **Commit documentation updates**:
   ```bash
   git add CHANGELOG.md CHANGELOG-JP.md README.md README-JP.md
   git commit -m "docs: finalize vX.X.X release documentation"
   ```
6. **Push release to remote**:
   ```bash
   git push origin main      # Push release commits
   git push origin vX.X.X    # Push version tag
   ```
7. **GitHub Actions automatically creates release artifacts** with tar.gz and zip files

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
npm run setup              # Install dependencies and build

# Data management tools
npm run calculate-daily-averages  # Manual daily average calculation tool
npm run sync-google-sheets        # Manual CSV to Google Sheets synchronization

# Release management
npm run release            # Patch release (1.0.0 → 1.0.1)
npm run release:minor      # Minor release (1.0.0 → 1.1.0)
npm run release:major      # Major release (1.0.0 → 2.0.0)
npm run prerelease         # Run tests before release
npm run test:ci            # CI test suite (typecheck + lint)
npm run prepare-release    # Full release preparation

# Platform-specific scripts
# Windows: build.bat, start.bat, setup.bat, sync-google-sheets.bat
# Windows (PowerShell): build.ps1, start.ps1, setup.ps1, sync-google-sheets.ps1
# Linux/macOS: build.sh, start.sh, setup.sh, sync-google-sheets.sh
```

## Architecture Overview

**Main Class**: `SteamPlayerTracker` (src/steamPlayerTracker.ts) - Central coordinator that orchestrates all services

**Service-Oriented Design**:
- `SteamApiService`: Fetches current player counts from Steam Web API
- `CsvWriter`: Handles CSV file operations for data persistence
- `GoogleSheetsService`: Direct Google Sheets integration for cloud storage
- `QueuedGoogleSheetsService`: Rate limit-aware Google Sheets service with retry queue
- `DailyAverageService`: Calculates and manages daily player count averages with max/min tracking
- `Scheduler`: Manages cron-based data collection and daily calculations
- `RetryHandler`: Implements exponential backoff retry logic
- `Logger`: Winston-based logging with file rotation

**Data Flow**: Steam API → Data Collection → Parallel Storage (CSV + Google Sheets with Queue) → Enhanced Daily Average Calculation (avg/max/min with timestamps)

## Configuration System

Configuration is environment-based using dotenv with validation in `src/config/config.ts`:

**Required**: Copy `.env.example` to `.env` and configure:
- `STEAM_APP_ID`: Steam game App ID to track
- `COLLECTION_MINUTES`: Comma-separated minutes for data collection (e.g., "0,30")
- `DAILY_AVERAGE_HOUR`: Hour (0-23) for daily average calculation

**Output Configuration**:
- `CSV_OUTPUT_ENABLED`: Enable/disable CSV file output (default: true)
- `CSV_FILE_PATH`: Path for main player data CSV file
- `DAILY_AVERAGE_CSV_ENABLED`: Enable/disable daily average CSV output (default: true)
- `DAILY_AVERAGE_CSV_FILE_PATH`: Path for daily averages CSV file

**Retry and Logging Configuration**:
- `MAX_RETRIES`: Maximum retry attempts for API calls (default: 3)
- `RETRY_BASE_DELAY`: Base delay for retry logic in milliseconds (default: 1000)
- `LOG_LEVEL`: Logging level (debug/info/warn/error, default: info)
- `LOG_FILE_PATH`: Path for log file output

**Optional Google Sheets Integration**:
- Set `GOOGLE_SHEETS_ENABLED=true`
- Configure `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`
- `GOOGLE_SHEETS_SHEET_NAME`: Sheet name for player data (default: PlayerData)
- `GOOGLE_SHEETS_DAILY_AVERAGE_SHEET_NAME`: Sheet name for daily averages (default: DailyAverages)
- `GOOGLE_SHEETS_SYNC_ON_STARTUP`: Sync CSV data to sheets on startup (default: false)
- Requires Google Cloud service account with Sheets API access

## Key Implementation Details

**Error Handling**: 
- Steam API returns 0 players are treated as failed requests and trigger retries
- Google Sheets API rate limit failures are queued for automatic retry
- QueuedGoogleSheetsService handles transient failures with exponential backoff

**Startup Behavior**:
1. Immediate data collection on startup
2. Validation of Steam API connectivity  
3. Check and calculate missing daily averages
4. Optional CSV-to-Google Sheets sync (if GOOGLE_SHEETS_SYNC_ON_STARTUP=true)
5. Schedule ongoing collection and daily calculations

**File Structure**:
- `src/index.ts`: Application entry point
- `src/config/`: Configuration management and validation
- `src/services/`: All business logic services
  - `steamApi.ts`: Steam Web API integration
  - `csvWriter.ts`: CSV file operations
  - `googleSheets.ts`: Direct Google Sheets integration
  - `queuedGoogleSheets.ts`: Rate limit-aware Google Sheets with retry queue
  - `dailyAverageService.ts`: Daily statistics calculation with max/min tracking
  - `scheduler.ts`: Cron-based scheduling system
- `src/tools/`: Command-line utilities
  - `calculateAllDailyAverages.ts`: Manual daily average calculation
  - `syncGoogleSheets.ts`: CSV-to-Google Sheets synchronization tool
- `src/types/`: TypeScript type definitions
- `src/utils/`: Shared utilities (logging, retry logic)

**Data Storage**: 
- **Main CSV**: timestamp,player_count format
- **Daily Average CSV**: Enhanced format with date,average_player_count,sample_count,max_player_count,max_timestamp,min_player_count,min_timestamp
- Daily averages exclude zero values (API failures)
- **Google Sheets**: Mirrors CSV structure in separate sheets (PlayerData + DailyAverages)
- **Rate Limit Handling**: QueuedGoogleSheetsService manages API quotas and retries
- **Manual Sync**: `npm run sync-google-sheets` for resolving data discrepancies