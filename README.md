# SteamPlayerTracker

[English](README.md) | [日本語](README-JP.md)

A Bun-based TypeScript application that periodically fetches concurrent player counts for Steam games via the Steam Web API, records data to SQLite, and optionally syncs to Google Sheets.

## Features

- Scheduled player count collection (setInterval-based)
- SQLite storage (WAL mode) with automatic schema migration
- Daily statistics: average, max/min player counts with timestamps
- Optional Google Sheets sync with rate limiting (100ms)
- Automatic retry with exponential backoff
- Zod validation for all external data (config, API responses)
- Graceful shutdown handling

## Requirements

- [Bun](https://bun.sh/) v1.3.11+
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
bun run import-csv           # Import existing CSV data into SQLite
bun run export-csv           # Export SQLite data to CSV
bun run generate-charts      # Generate chart images
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
| `DB_PATH` | SQLite database file path | `data/steam-tracker.db` |
| `COLLECTION_MINUTES` | Minutes to collect data (comma-separated) | `0,30` |
| `DAILY_AVERAGE_HOUR` | Hour to calculate daily averages (0-23) | `0` |
| `SHEETS_SYNC_MINUTES` | Minutes to sync to Google Sheets (comma-separated) | `5,35` |
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

## Data Storage

Data is stored in SQLite (`data/steam-tracker.db` by default).

**Player count table** (`player_data`):

| Column | Type | Description |
|--------|------|-------------|
| `timestamp` | TEXT | UTC timestamp (YYYY-MM-DD HH:mm:ss) |
| `player_count` | INTEGER | Concurrent player count |
| `synced_at` | TEXT | Google Sheets sync timestamp (NULL if unsynced) |

**Daily averages table** (`daily_averages`):

| Column | Type | Description |
|--------|------|-------------|
| `date` | TEXT (PK) | Date (YYYY-MM-DD) |
| `average_player_count` | INTEGER | Average player count |
| `sample_count` | INTEGER | Number of samples |
| `max_player_count` | INTEGER | Maximum player count |
| `max_timestamp` | TEXT | Timestamp of max count |
| `min_player_count` | INTEGER | Minimum player count |
| `min_timestamp` | TEXT | Timestamp of min count |

Records with 0 player count are excluded from averages (treated as API failures).

## Project Structure

```
src/
├── main.ts              # Entry point, scheduler registration
├── config.ts            # Env parsing with Zod discriminated union
├── db.ts                # SQLite initialization, migrations, query helpers
├── logger.ts            # Structured JSON logger (stdout)
├── retry.ts             # Exponential backoff retry handler
├── googleSheets.ts      # Generic Google Sheets accessor (SheetAccessor<T>)
├── schemas/             # Zod schemas (Steam API, Google credentials)
├── jobs/                # Cron jobs (collectData, dailyAverage, syncSheets)
└── tools/               # CLI tools (importCsv, exportCsv, generateCharts)
scripts/
├── build.ts             # Bun.build script
├── release.ts           # Version bump, changelog, git tag
├── setup.ps1            # Setup (PowerShell)
├── start.ps1            # Start (PowerShell)
└── sync-google-sheets.ps1  # Google Sheets sync (PowerShell)
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
