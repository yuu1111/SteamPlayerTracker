# SteamPlayerTracker

**Languages:** [English](README.md) | [日本語](README-JP.md)

SteamPlayerTracker is an application that periodically retrieves the current concurrent player count of specified Steam games and records the data in CSV format. It also provides optional Google Sheets integration functionality.

## Features

- 🎮 **Steam Web API Player Count Retrieval**: Automatically fetches current player count for specified games
- 📊 **CSV Format Recording**: Saves player count data to CSV files with timestamps
- 📈 **Enhanced Daily Statistics**: Records daily averages with max/min player counts and their timestamps
- 🔄 **CSV-Google Sheets Sync**: Manual synchronization tool to resolve data discrepancies
- 📋 **Google Sheets Integration**: Optional direct data writing to spreadsheets with rate limit handling
- ⏰ **Flexible Scheduling**: Periodic execution with customizable minute intervals
- 🔄 **Error Handling & Retry Functionality**: Automatic retry with exponential backoff
- 📝 **Detailed Logging**: Log level management with rotation support
- 🛡️ **Type Safety**: TypeScript type checking
- 🚀 **Immediate Data Collection on Startup**: Fetches current player count when script starts
- 📊 **Automatic Daily Average Backfill**: Automatically calculates missing daily averages on startup
- 🖥️ **Cross-Platform Scripts**: PowerShell, Bash, and Batch scripts for all operations

## Requirements

- Node.js 18.x or higher
- (Windows) PowerShell Core (pwsh) - Install from [https://aka.ms/PSWindows](https://aka.ms/PSWindows)
- (Optional) Google Cloud Platform account (for spreadsheet integration)

## Setup

### Quick Setup (Recommended)

**Windows:**
```batch
setup.bat
```

**Linux/macOS:**
```bash
./setup.sh
```

### Manual Setup

#### 1. Clone Project and Install Dependencies

```bash
git clone <repository-url>
cd SteamPlayerTracker
npm install
```

#### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit the `.env` file:

```env
# Steam Settings
STEAM_APP_ID=730

# Output Settings
CSV_OUTPUT_ENABLED=true
CSV_FILE_PATH=steam_concurrent_players.csv
DAILY_AVERAGE_CSV_ENABLED=true
DAILY_AVERAGE_CSV_FILE_PATH=steam_daily_averages.csv

# Scheduling Settings (specify minutes: comma-separated)
COLLECTION_MINUTES=0,30
# Hour to calculate daily averages (0-23)
DAILY_AVERAGE_HOUR=0

# Retry Settings
MAX_RETRIES=3
RETRY_BASE_DELAY=1000

# Logging Settings
LOG_LEVEL=info
LOG_FILE_PATH=logs/steam-tracker.log

# Google Sheets Integration (Optional)
GOOGLE_SHEETS_ENABLED=false
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_SHEET_NAME=PlayerData
GOOGLE_SHEETS_DAILY_AVERAGE_SHEET_NAME=DailyAverages
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=
```

#### 3. Finding Game IDs

You can find App IDs from Steam store page URLs:
- Example: `https://store.steampowered.com/app/730/` → App ID is `730` (Counter-Strike 2)

## Usage

### Quick Start (Windows)

```batch
# Build only
build.bat

# Build and start
start.bat
```

### Quick Start (Linux/macOS)

```bash
# Build only
./build.sh

# Build and start
./start.sh
```

### Development Environment

```bash
npm run dev
```

### Production Environment

```bash
npm run build
npm start
```

### Manual Daily Average Calculation

Calculate all daily averages from historical data:

```bash
npm run calculate-daily-averages
```

### Google Sheets Synchronization

Manually sync local CSV data with Google Sheets:

```bash
# Using npm command
npm run sync-google-sheets

# Using platform-specific scripts
sync-google-sheets.bat    # Windows (Batch)
sync-google-sheets.ps1    # Windows (PowerShell)
./sync-google-sheets.sh   # Linux/macOS
```

### Background Execution (Linux/Mac)

```bash
nohup npm start > output.log 2>&1 &
```

### Windows Background Execution

```bash
# PowerShell
Start-Process npm -ArgumentList "start" -WindowStyle Hidden
```

## Release Management

### Automated Release

```bash
npm run release          # Patch release (1.0.0 → 1.0.1)
npm run release:minor    # Minor release (1.0.0 → 1.1.0)
npm run release:major    # Major release (1.0.0 → 2.0.0)
```

The release script automatically:
- Runs type checking and linting
- Builds the application
- Updates version in package.json
- Creates Git commit and tag
- Prepares for GitHub Actions deployment

### GitHub Actions

After running the release script locally:
1. `git push origin main`
2. `git push origin v1.0.1` (push the created tag)
3. GitHub Actions automatically creates release artifacts

## Google Sheets Integration (Optional)

### 1. Google Cloud Platform Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Google Sheets API
3. Create a service account and download the key file (JSON)

### 2. Environment Configuration

```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_SHEET_NAME=PlayerData
GOOGLE_SHEETS_DAILY_AVERAGE_SHEET_NAME=DailyAverages
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=path/to/service-account-key.json
```

### 3. Spreadsheet Sharing

Share the created spreadsheet with the service account email address.

## Configuration Options

| Setting | Description | Default Value |
|---------|-------------|---------------|
| `STEAM_APP_ID` | App ID of the game to track | Required |
| `CSV_OUTPUT_ENABLED` | Enable/disable CSV output | `true` |
| `CSV_FILE_PATH` | CSV output file path | `steam_concurrent_players.csv` |
| `DAILY_AVERAGE_CSV_ENABLED` | Enable/disable daily average CSV output | `true` |
| `DAILY_AVERAGE_CSV_FILE_PATH` | Daily average CSV output file path | `steam_daily_averages.csv` |
| `COLLECTION_MINUTES` | Minutes to collect data (comma-separated) | `0,30` |
| `DAILY_AVERAGE_HOUR` | Hour to calculate daily averages (0-23) | `0` |
| `MAX_RETRIES` | Maximum retry attempts | `3` |
| `RETRY_BASE_DELAY` | Base retry delay (ms) | `1000` |
| `LOG_LEVEL` | Log level (debug/info/warn/error) | `info` |
| `LOG_FILE_PATH` | Log file path | `logs/steam-tracker.log` |

## CSV File Structure

### Main Data File
```csv
timestamp,player_count
2024-06-23 10:00:00,12345
2024-06-23 10:30:00,13456
```

### Daily Average File (Enhanced Format)
```csv
date,average_player_count,sample_count,max_player_count,max_timestamp,min_player_count,min_timestamp
2024-06-22,12890,48,15420,2024-06-22 18:30:00,8450,2024-06-22 05:00:00
2024-06-23,13245,48,16890,2024-06-23 19:00:00,9120,2024-06-23 04:30:00
```

**Note**: When calculating daily averages, data with 0 player count is excluded (considered API fetch failures). The enhanced format includes maximum and minimum player counts with their exact timestamps.

## Troubleshooting

### Common Issues

1. **Steam API Errors**
   - Verify App ID is valid
   - Check network connectivity

2. **File Write Errors**
   - Check disk space
   - Verify file/directory permissions

3. **Google Sheets Errors**
   - Verify service account key file path
   - Check spreadsheet ID
   - Ensure spreadsheet is shared with service account

### Log Checking

```bash
# View log file
tail -f logs/steam-tracker.log

# Filter errors only
grep "ERROR" logs/steam-tracker.log
```

## Development

### Scripts

```bash
npm run build      # Compile TypeScript
npm run dev        # Run in development mode
npm run watch      # Watch files and compile
npm run clean      # Clear dist directory
npm run lint       # ESLint static analysis
npm run typecheck  # TypeScript type checking
npm run calculate-daily-averages  # Calculate all daily averages
npm run sync-google-sheets       # Sync CSV data to Google Sheets
```

### Platform Scripts

| File | Description | Platform |
|------|-------------|----------|
| `setup.bat` | Initial setup batch file | Windows |
| `build.bat` | Build batch file | Windows |
| `start.bat` | Start batch file | Windows |
| `sync-google-sheets.bat` | Google Sheets sync batch file | Windows |
| `setup.ps1` | Initial setup PowerShell Core script | Windows |
| `build.ps1` | Build PowerShell Core script | Windows |
| `start.ps1` | Start PowerShell Core script | Windows |
| `sync-google-sheets.ps1` | Google Sheets sync PowerShell script | Windows |
| `setup.sh` | Initial setup shell script | Linux/macOS |
| `build.sh` | Build shell script | Linux/macOS |
| `start.sh` | Start shell script | Linux/macOS |
| `sync-google-sheets.sh` | Google Sheets sync shell script | Linux/macOS |

### Directory Structure

```
src/
├── config/          # Configuration management
├── services/        # Various services
│   ├── csvWriter.ts
│   ├── dailyAverageService.ts
│   ├── googleSheets.ts
│   ├── scheduler.ts
│   └── steamApi.ts
├── tools/           # Command-line tools
│   └── calculateAllDailyAverages.ts
├── types/           # Type definitions
├── utils/           # Utilities
├── steamPlayerTracker.ts  # Main class
└── index.ts         # Entry point
```

## License

MIT License