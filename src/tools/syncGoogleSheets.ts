import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config/config";
import { GoogleSheetsService } from "../services/googleSheets";
import type { PlayerDataRecord } from "../types/config";
import { createLogger } from "../utils/logger";

const logger = createLogger("sync-google-sheets");

async function readCsvFile(filePath: string): Promise<string[][]> {
	try {
		const content = await fs.readFile(filePath, "utf8");
		const lines = content.trim().split("\n");
		return lines.map((line) => line.split(",").map((cell) => cell.trim()));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

async function syncPlayerData(
	googleSheets: GoogleSheetsService,
): Promise<void> {
	const csvPath = resolve(
		import.meta.dirname,
		"../../steam_concurrent_players.csv",
	);
	const csvData = await readCsvFile(csvPath);

	if (csvData.length <= 1) {
		logger.info("No player data to sync");
		return;
	}

	logger.info(`Found ${csvData.length - 1} records in CSV`);

	const records: PlayerDataRecord[] = [];
	for (let i = 1; i < csvData.length; i++) {
		const row = csvData[i];
		if (!row) continue;

		const timestamp = row[0];
		const playerCount = row[1];

		if (timestamp && playerCount) {
			const record: PlayerDataRecord = {
				timestamp: timestamp,
				playerCount: Number.parseInt(playerCount, 10),
			};

			if (!Number.isNaN(record.playerCount)) {
				records.push(record);
			}
		}
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
	const csvData = await readCsvFile(csvPath);

	if (csvData.length <= 1) {
		logger.info("No daily average data to sync");
		return;
	}

	logger.info(`Found ${csvData.length - 1} daily average records in CSV`);

	const headerRow = csvData[0];
	const hasExtendedData = headerRow ? headerRow.length > 3 : false;

	const records = [];
	for (let i = 1; i < csvData.length; i++) {
		const row = csvData[i];
		if (!row || row.length < 3) continue;

		const timestamp = row[0] ?? "";
		const playerCount = Number.parseInt(row[1] ?? "", 10);
		const sampleCount = Number.parseInt(row[2] ?? "", 10);

		if (!Number.isNaN(playerCount) && !Number.isNaN(sampleCount)) {
			records.push({
				timestamp,
				playerCount,
				sampleCount,
				maxPlayerCount:
					hasExtendedData && row[3] ? Number.parseInt(row[3], 10) : undefined,
				maxPlayerTimestamp: hasExtendedData && row[4] ? row[4] : undefined,
				minPlayerCount:
					hasExtendedData && row[5] ? Number.parseInt(row[5], 10) : undefined,
				minPlayerTimestamp: hasExtendedData && row[6] ? row[6] : undefined,
			});
		}
	}

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

		const playerDataSheets = new GoogleSheetsService(
			config.googleSheets.spreadsheetId,
			config.googleSheets.sheetName,
			config.googleSheets.serviceAccountKeyPath,
		);

		const dailyAverageSheets = new GoogleSheetsService(
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
