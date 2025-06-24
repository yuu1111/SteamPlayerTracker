# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Languages:** [English](CHANGELOG.md) | [日本語](CHANGELOG-JP.md)  

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