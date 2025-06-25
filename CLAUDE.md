# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Language**: When working in this repository, communicate with users in Japanese. Keep this CLAUDE.md file in English.

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
npm run calculate-daily-averages  # Manual daily average calculation tool
npm run sync-google-sheets        # Sync local CSV data to Google Sheets

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