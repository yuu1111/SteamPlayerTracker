import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config/config";
import {
	createGoogleSheetsService,
	type GoogleSheetsService,
} from "../services/googleSheets";
import { parseDailyAverageCsv, parsePlayerDataCsv } from "../utils/csv-parser";
import { createLogger } from "../utils/logger";

const logger = createLogger("sync-google-sheets");

async function syncPlayerData(
	googleSheets: GoogleSheetsService,
): Promise<void> {
	const csvPath = resolve(
		import.meta.dirname,
		"../../steam_concurrent_players.csv",
	);

	let content: string;
	try {
		content = await fs.readFile(csvPath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			logger.info("No player data to sync");
			return;
		}
		throw error;
	}

	const records = parsePlayerDataCsv(content);

	if (records.length === 0) {
		logger.info("No player data to sync");
		return;
	}

	logger.info(`Parsed ${records.length} valid records`);
	logger.info("Replacing all Google Sheets data with sorted CSV data...");
	await googleSheets.replaceAllRecords(records);
	logger.info("Player data sync completed - all data replaced and sorted");
}

async function syncDailyAverages(
	googleSheets: GoogleSheetsService,
): Promise<void> {
	const csvPath = resolve(
		import.meta.dirname,
		"../../steam_daily_averages.csv",
	);

	let content: string;
	try {
		content = await fs.readFile(csvPath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			logger.info("No daily average data to sync");
			return;
		}
		throw error;
	}

	const avgRecords = parseDailyAverageCsv(content);

	if (avgRecords.length === 0) {
		logger.info("No daily average data to sync");
		return;
	}

	const records = avgRecords.map((r) => ({
		timestamp: r.date,
		playerCount: r.averagePlayerCount,
		sampleCount: r.sampleCount,
		maxPlayerCount: r.maxPlayerCount,
		maxPlayerTimestamp: r.maxPlayerTimestamp,
		minPlayerCount: r.minPlayerCount,
		minPlayerTimestamp: r.minPlayerTimestamp,
	}));

	logger.info(`Parsed ${records.length} valid daily average records`);
	logger.info(
		"Replacing all Google Sheets daily average data with sorted CSV data...",
	);
	await googleSheets.replaceAllDailyAverageRecords(records);
	logger.info("Daily average sync completed - all data replaced and sorted");
}

async function main(): Promise<void> {
	try {
		if (!config.googleSheets.enabled) {
			logger.error("Google Sheets is not enabled in configuration");
			console.error(
				"Google Sheets is not enabled. Set GOOGLE_SHEETS_ENABLED=true in .env",
			);
			process.exit(1);
		}

		logger.info("Starting Google Sheets sync...");

		const playerDataSheets = createGoogleSheetsService(
			config.googleSheets.spreadsheetId,
			config.googleSheets.sheetName,
			config.googleSheets.serviceAccountKeyPath,
		);

		const dailyAverageSheets = createGoogleSheetsService(
			config.googleSheets.spreadsheetId,
			config.googleSheets.dailyAverageSheetName,
			config.googleSheets.serviceAccountKeyPath,
		);

		logger.info("Syncing player data...");
		await syncPlayerData(playerDataSheets);

		logger.info("Syncing daily averages...");
		await syncDailyAverages(dailyAverageSheets);

		logger.info("All data synced successfully");
		console.log("Google Sheets sync completed successfully!");

		process.exit(0);
	} catch (error) {
		logger.error(
			`Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		console.error(
			`Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		process.exit(1);
	}
}

main();

export { syncDailyAverages, syncPlayerData };
