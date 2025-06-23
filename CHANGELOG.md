# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Languages:** [English](CHANGELOG.md) | [日本語](CHANGELOG-JP.md)

## [Unreleased]

### Added
- Automated release management system with GitHub Actions
- ESLint configuration for code quality
- Release scripts for patch, minor, and major versions
- Continuous Integration (CI) workflow for pull requests and pushes
- Automated release workflow that creates GitHub releases with artifacts
- English and Japanese documentation (README.md and README-JP.md)
- Changelog documentation in both languages

### Changed
- Updated package.json with new release-related npm scripts
- Enhanced README with release management instructions
- Improved project documentation structure

### Technical Improvements
- Added automated type checking and linting in release process
- Implemented tar.gz and zip artifact generation for releases
- Set up proper Node.js version matrix testing (18, 20)
- Added startup validation in CI pipeline

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