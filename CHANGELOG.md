# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Languages:** [English](CHANGELOG.md) | [日本語](CHANGELOG-JP.md)

## [2.0.0] - 2026-03-25 JST

### Breaking Changes
- **Runtime**: Migrated from Node.js to Bun. Use `bun install` / `bun run` to execute
- **Storage**: Migrated from CSV files to SQLite (WAL mode). Data stored in `data/tracker.db`
- **Build**: Replaced tsc with Bun.build (ESM, code splitting enabled)
- **Lint/Format**: Replaced ESLint + Prettier with Biome
- **Module**: Migrated from CommonJS to ESM
- **Logger**: Replaced Winston with lightweight structured JSON stdout logger. File output delegated to process managers
- **Scheduler**: Replaced node-cron with setInterval-based scheduling
- **Config**: Replaced manual dotenv parsing with Zod schema validation. Discriminated unions for type-safe Google Sheets enabled/disabled branching

### Added
- **SQLite storage**: Zero-dependency database via bun:sqlite. WAL mode, prepared statements, transaction support
- **Zod validation**: Type-safe validation for config and Steam API responses
- **CSV import/export tools**: Bidirectional conversion between existing CSV data and SQLite (`bun run import-csv` / `bun run export-csv`)
- **Test suite**: 114 tests via bun test with 97% coverage
- **DB-driven Google Sheets sync**: Tracks unsynced records via `synced_at IS NULL`. No data loss on process restart
- **Daily average sync batchAppend**: Reduced N API calls to 1
- **Concurrent execution guard**: Prevents overlapping setInterval executions
- **Graceful shutdown**: Signal listeners to cancel cron jobs and close DB
- **TypeScript release script**: Converted release.cjs to scripts/release.ts

### Changed
- **Full architecture overhaul**: Converted class-based services to function-based/factory patterns
- **Dependency injection**: No service container. Assembled in main.ts and passed via function arguments
- **Google Sheets accessor**: Type-safe Sheets operations via generic SheetAccessor\<T>
- **Retry**: Unified exponential backoff (5x multiplier, max 30s)
- **CI/CD**: Migrated from Node.js/npm to Bun. Pipeline: `typecheck` → `lint` → `build`
- **Tool execution**: No build required, TypeScript executed directly via Bun
- **Daily average sync**: Upsert (append) approach to prevent duplicate rows
- **TypeScript 5.9 strict mode**: Inherits `@yuu1111/tsconfig`, `using` declarations supported

### Removed
- **CSV storage**: Fully replaced by SQLite
- **Winston logger**: Replaced by lightweight structured logger
- **node-cron**: Replaced by setInterval
- **ESLint / Prettier**: Replaced by Biome
- **bat/sh/ps1 startup scripts**: Removed
- **steamApi.ts**: Consolidated into retry.ts
- **@types/node**: Replaced by @types/bun

### Fixed
- Prevented duplicate rows in daily average sync (upsert)
- Unified API rate limit handling
- Fixed chart date range boundaries
- Fixed DDL null guard
- Fixed markSynced statement finalize safety

## [1.3.0] - 2025-06-25 JST

### Added
- **Chart Generation Feature**: New capability to generate visual charts from CSV data
  - Player count trend charts (1-day, 7-day, 30-day periods)
  - Daily statistics charts with average, max, and min values (7-day, 30-day, 60-day periods)
  - High-resolution PNG output (1600x900px) using Chart.js
  - `npm run generate-charts` command for chart generation
  - Flexible command-line options for specific chart types and time periods
- **Session-based Logging**: New Winston transport for session-specific log files
  - Logs organized by session timestamp (YYYY-MM-DD-HHmm format)
  - Automatic old log cleanup utility
  - Separate error log files for better debugging
- **Process Management Script**: Added `Kill-SteamTracker.ps1` for Windows process management

### Changed
- **Logger System Refactoring**: Migrated from legacy Logger class to unified createLogger function
  - Improved type safety with TypeScript
  - Better module isolation with child loggers
  - Enhanced log formatting with module context
- **Performance Optimizations**:
  - Replaced ts-node with pre-compiled JavaScript execution (faster startup)
  - Optimized Google Sheets sync to use bulk uploads instead of individual requests
  - Reduced API rate limit issues with batch processing
- **Tool Scripts Enhancement**:
  - `calculate-daily-averages` now performs bulk Google Sheets upload
  - `sync-google-sheets` includes explicit process termination
  - All tools now use compiled JavaScript for better performance

### Fixed
- Google Sheets rate limiting issues in daily average calculations
- Process hanging after Google Sheets operations (added explicit exit)
- ESLint errors and warnings in the codebase
- Type safety issues with Winston logger integration

### Technical
- Removed legacy Logger class in favor of functional approach
- Updated all imports from Logger to createLogger
- Added chart.js, chartjs-node-canvas, and date-fns dependencies
- Improved TypeScript type definitions throughout the codebase

## [1.2.0] - 2025-06-25 JST

### Added
- Daily max/min player counts with timestamps in statistics
- CSV and Google Sheets sync functionality to handle data discrepancies
- `npm run sync-google-sheets` command for manual data synchronization
- `GOOGLE_SHEETS_SYNC_ON_STARTUP` environment variable for automatic sync on startup
- Extended daily averages CSV format with max_player_count, max_timestamp, min_player_count, min_timestamp columns
- Enhanced Google Sheets integration with duplicate detection and data update capabilities

### Enhanced
- Daily average records now include peak and low player counts with their exact timestamps
- Google Sheets service automatically prevents duplicate entries by checking timestamps
- Startup process can optionally sync local CSV data with Google Sheets
- Daily statistics logging now includes max/min values and their timestamps

### Technical
- Extended `DailyAverageRecord` interface with max/min tracking fields
- Improved `GoogleSheetsService` with `findRecordByTimestamp` and `findDailyAverageRecordByDate` methods
- Added `syncGoogleSheets.ts` tool for comprehensive data synchronization
- Enhanced CSV writer with backward compatibility for extended daily average format

## [1.1.4] - 2025-06-24 JST

### Added
- UTC timezone clarification in Google Sheets headers
- Improved window titles for setup.bat/setup.ps1 scripts to show "Setting up..." status
- Improved window titles for build.bat/build.ps1 scripts to show "Building..." status

### Fixed
- Daily average calculation tasks now persist during data collection scheduling
- Scheduler no longer stops daily tasks when rescheduling data collection

### Changed
- Enhanced window title consistency across all platform scripts
- Google Sheets headers now clearly indicate "timestamp (UTC)" and "date (UTC)"

## [1.1.3] - 2025-06-24 JST

### Added
- Dynamic window title updates on Windows showing game name and current player count
- Game name detection from Steam Store API for enhanced user experience
- Improved window title progression (Starting... → Game Name → Game Name: X players)

### Changed
- Enhanced startup scripts to show "Starting..." before application takes over title
- Window title now updates in real-time with latest player count data

## [1.1.2] - 2025-06-24 JST

### Fixed
- Modernized and optimized ESLint configuration for faster execution (35s → 15s)
- Updated TypeScript ESLint plugin and parser to v7.18.0
- Upgraded rimraf to v6.0.1 to resolve deprecation warnings
- Fixed Google Sheets API calls to use correct requestBody parameter
- Added timeout to release script commands to prevent hanging

### Performance Improvements
- Removed TypeScript project parsing from ESLint for significant speed improvement
- Streamlined ESLint rules to essential checks only
- Excluded scripts directory from ESLint to prevent unnecessary checks

### Technical Debt
- Resolved deprecated package warnings (inflight, config-array, etc.)
- Improved CI/CD pipeline performance while maintaining code quality

## [1.1.1] - 2025-06-24 JST

### Fixed
- Improved release archive structure with proper folder naming
- Excluded development scripts (release.js) from release packages
- Added .env.example to release archives for easier user setup

### Changed
- Release archives now use consistent naming (steam-player-tracker-vX.X.X/)
- Streamlined release packages to include only production-necessary files

## [1.1.0] - 2024-06-23

### Added
- Automated release management system with GitHub Actions
- ESLint configuration for code quality
- Release scripts for patch, minor, and major versions
- Continuous Integration (CI) workflow for pull requests and pushes
- Automated release workflow that creates GitHub releases with artifacts
- English and Japanese documentation (README.md and README-JP.md)
- Changelog documentation in both languages
- Conventional commit message format guidelines in CLAUDE.md

### Changed
- Updated package.json with new release-related npm scripts
- Enhanced README with release management instructions
- Improved project documentation structure

### Fixed
- Resolved all ESLint warnings with proper TypeScript types
- Fixed error handling in dailyAverageService.ts
- Improved type safety in GoogleSheetsService and Logger

### Technical Improvements
- Added automated type checking and linting in release process
- Implemented tar.gz and zip artifact generation for releases
- Set up proper Node.js version matrix testing (18, 20)
- Added startup validation in CI pipeline
- Enhanced release workflow to include changelog content in GitHub releases

## [1.0.0] - Initial Release

### Added
- Steam Web API integration for player count retrieval
- CSV data export functionality with timestamps
- Google Sheets integration (optional)
- Daily average calculation with automatic backfill
- Flexible scheduling system with customizable intervals
- Comprehensive error handling with exponential backoff retry
- Winston-based logging with file rotation
- TypeScript type safety throughout the application
- Cross-platform startup scripts (Windows, Linux, macOS)
- Environment-based configuration system
- Immediate data collection on startup
- Automatic calculation of missing daily averages

### Features
- **Data Collection**: Periodic retrieval of concurrent player counts from Steam Web API
- **Storage Options**: Local CSV files and optional Google Sheets synchronization
- **Scheduling**: Customizable data collection intervals (minute-based cron scheduling)
- **Data Processing**: Daily average calculations excluding zero values (API failures)
- **Error Resilience**: Automatic retry mechanism with exponential backoff
- **Monitoring**: Comprehensive logging with configurable levels and rotation
- **Cross-Platform**: Support for Windows (batch/PowerShell), Linux, and macOS
- **Type Safety**: Full TypeScript implementation with strict type checking

### Configuration
- Steam App ID specification for game tracking
- Flexible output configuration (CSV file paths, Google Sheets settings)
- Customizable scheduling (collection minutes, daily average calculation hour)
- Retry behavior configuration (max retries, base delay)
- Logging configuration (level, file path)
- Optional Google Sheets integration with service account authentication

### Technical Stack
- **Runtime**: Node.js 18+ with TypeScript
- **APIs**: Steam Web API, Google Sheets API
- **Data Storage**: CSV files, Google Sheets
- **Scheduling**: node-cron
- **Logging**: Winston with file rotation
- **HTTP Client**: Axios with retry logic
- **Configuration**: dotenv with validation