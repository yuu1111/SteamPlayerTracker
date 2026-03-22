import * as dotenv from "dotenv";
import type { Config } from "../types/config";

dotenv.config();

function parseMinutes(minutesStr: string): number[] {
	return minutesStr
		.split(",")
		.map((m) => Number.parseInt(m.trim(), 10))
		.filter((m) => !Number.isNaN(m) && m >= 0 && m < 60);
}

function validateConfig(): Config {
	const steamAppId = process.env.STEAM_APP_ID;

	if (!steamAppId || Number.isNaN(Number.parseInt(steamAppId, 10))) {
		throw new Error(
			"STEAM_APP_ID must be a valid number in environment variables",
		);
	}

	const config = {
		steam: {
			appId: Number.parseInt(steamAppId, 10),
		},

		output: {
			csvEnabled: process.env.CSV_OUTPUT_ENABLED !== "false",
			csvFilePath: process.env.CSV_FILE_PATH || "steam_concurrent_players.csv",
			dailyAverageCsvEnabled: process.env.DAILY_AVERAGE_CSV_ENABLED !== "false",
			dailyAverageCsvFilePath:
				process.env.DAILY_AVERAGE_CSV_FILE_PATH || "steam_daily_averages.csv",
		},

		scheduling: {
			collectionMinutes: parseMinutes(process.env.COLLECTION_MINUTES || "0,30"),
			dailyAverageHour: Number.parseInt(
				process.env.DAILY_AVERAGE_HOUR || "0",
				10,
			),
		},

		retry: {
			maxRetries: Number.parseInt(process.env.MAX_RETRIES || "3", 10),
			baseDelay: Number.parseInt(process.env.RETRY_BASE_DELAY || "1000", 10),
		},

		logging: {
			level: process.env.LOG_LEVEL || "info",
			filePath: process.env.LOG_FILE_PATH || "logs/steam-tracker.log",
		},
	} as Config;

	if (process.env.GOOGLE_SHEETS_ENABLED === "true") {
		const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
		const serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;

		if (!spreadsheetId) {
			throw new Error(
				"GOOGLE_SHEETS_SPREADSHEET_ID is required when Google Sheets is enabled",
			);
		}

		if (!serviceAccountKeyPath) {
			throw new Error(
				"GOOGLE_SERVICE_ACCOUNT_KEY_PATH is required when Google Sheets is enabled",
			);
		}

		config.googleSheets = {
			enabled: true,
			spreadsheetId,
			sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || "PlayerData",
			dailyAverageSheetName:
				process.env.GOOGLE_SHEETS_DAILY_AVERAGE_SHEET_NAME || "DailyAverages",
			serviceAccountKeyPath,
			syncOnStartup: process.env.GOOGLE_SHEETS_SYNC_ON_STARTUP === "true",
		};
	} else {
		config.googleSheets = {
			enabled: false,
		};
	}

	return config;
}

export const config = validateConfig();
