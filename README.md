# SteamPlayerTracker

[English](README.md) | [日本語](README-JP.md)

A Bun-based TypeScript application that periodically fetches concurrent player counts for Steam games via the Steam Web API, records data to CSV, and optionally syncs to Google Sheets.

## Features

- Scheduled player count collection via `Bun.cron`
- CSV recording with timestamps
- Daily statistics: average, max/min player counts with timestamps
- Optional Google Sheets sync with rate-limited queue (100ms)
- Automatic retry with exponential backoff
- Zod validation for all external data (config, CSV, API responses)
- Graceful shutdown handling

## Requirements

- [Bun](https://bun.sh/) v1.1+
- (Optional) Google Cloud Platform service account for Sheets integration

## Setup

```bash
git clone https://github.com/yuu1111/SteamPlayerTracker.git
cd SteamPlayerTracker
bun install
```

Copy `.env.example` to `.env` and edit:

```bash
cp .env.example .env
```

At minimum, set `STEAM_APP_ID` to the game you want to track. Find it from the Steam store URL:

```
https://store.steampowered.com/app/730/ → STEAM_APP_ID=730 (Counter-Strike 2)
```

## Usage

```bash
bun run dev          # Watch mode
bun run build        # Build to dist/
bun run start        # Run built output
```

### Tools

```bash
bun run calculate-daily-averages   # Recalculate all daily averages from CSV
bun run sync-google-sheets         # Sync CSV data to Google Sheets
bun run generate-charts            # Generate chart images
```

### Quality

```bash
bun run typecheck    # TypeScript type check (tsc --noEmit)
bun run lint         # Biome lint
bun run format       # Biome format (--write --unsafe)
```

## Configuration

All configuration is via `.env`. See [`.env.example`](.env.example) for the full list.

| Variable | Description | Default |
|----------|-------------|---------|
| `STEAM_APP_ID` | Steam App ID to track | (required) |
| `COLLECTION_MINUTES` | Minutes to collect data (comma-separated) | `0,30` |
| `DAILY_AVERAGE_HOUR` | Hour to calculate daily averages (0-23) | `0` |
| `CSV_OUTPUT_ENABLED` | Enable CSV output | `true` |
| `DAILY_AVERAGE_CSV_ENABLED` | Enable daily average CSV | `true` |
| `MAX_RETRIES` | Max retry attempts | `3` |
| `LOG_LEVEL` | Log level (debug/info/warn/error) | `info` |
| `GOOGLE_SHEETS_ENABLED` | Enable Google Sheets integration | `false` |

### Google Sheets Integration

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Sheets API
3. Create a service account and download the JSON key
4. Share your spreadsheet with the service account email
5. Set the following in `.env`:

```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=path/to/key.json
```

## CSV Format

**Player count data** (`steam_concurrent_players.csv`):

```csv
timestamp,player_count
2024-06-23 10:00:00,12345
2024-06-23 10:30:00,13456
```

**Daily averages** (`steam_daily_averages.csv`):

```csv
date,average_player_count,sample_count,max_player_count,max_timestamp,min_player_count,min_timestamp
2024-06-22,12890,48,15420,2024-06-22 18:30:00,8450,2024-06-22 05:00:00
```

Records with 0 player count are excluded from averages (treated as API failures).

## Project Structure

```
src/
├── main.ts                    # Entry point, Bun.cron registration
├── config/config.ts           # Env parsing with Zod
├── schemas/                   # Zod schemas (config, CSV, Steam API, Google credentials)
├── services/
│   ├── steamApi.ts            # Steam Web API client
│   ├── csvWriter.ts           # CSV file writer
│   ├── dailyAverageService.ts # Daily average calculation
│   ├── googleSheets.ts        # Google Sheets API service
│   └── queuedGoogleSheets.ts  # Rate-limited Sheets queue
├── workers/
│   ├── collect-data.ts        # Scheduled data collection
│   └── daily-average.ts       # Scheduled daily average calculation
├── tools/                     # CLI tools (run directly with Bun)
└── utils/                     # Logger, retry, CSV parser
scripts/
├── build.ts                   # Bun.build script
├── release.ts                 # Version bump, changelog, git tag
├── setup.ps1                  # Setup (PowerShell)
├── start.ps1                  # Start (PowerShell)
└── sync-google-sheets.ps1     # Google Sheets sync (PowerShell)
```

## Release

```bash
bun run release              # Patch (1.0.0 → 1.0.1)
bun run release:minor        # Minor (1.0.0 → 1.1.0)
bun run release:major        # Major (1.0.0 → 2.0.0)
```

The release script runs quality checks, builds, bumps the version, and creates a git tag. Push the tag to trigger the GitHub Actions release workflow.

## License

[MIT](LICENCE)
