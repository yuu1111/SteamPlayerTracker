import { config } from "../config/config";
import {
	dailyAverageColumnDef,
	playerDataColumnDef,
} from "../schemas/columnDefs";
import { createSheetAccessor } from "../services/googleSheets";
import { parseDailyAverageCsv, parsePlayerDataCsv } from "../utils/csvParser";
import { createLogger } from "../utils/logger";

const logger = createLogger("sync-google-sheets");

/**
 * @description プレイヤーデータをGoogle Sheetsに同期
 * @param csvPath - CSVファイルパス
 */
async function syncPlayerData(csvPath: string): Promise<void> {
	if (!config.googleSheets.enabled) return;

	let content: string;
	try {
		content = await Bun.file(csvPath).text();
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

	const googleSheets = createSheetAccessor(
		config.googleSheets.spreadsheetId,
		config.googleSheets.sheetName,
		config.googleSheets.serviceAccountKeyPath,
		playerDataColumnDef,
	);

	logger.info(`Parsed ${records.length} valid records`);
	logger.info("Replacing all Google Sheets data with sorted CSV data...");
	await googleSheets.replaceAll(records);
	logger.info("Player data sync completed - all data replaced and sorted");
}

/**
 * @description 日次平均データをGoogle Sheetsに同期
 * @param csvPath - CSVファイルパス
 */
async function syncDailyAverages(csvPath: string): Promise<void> {
	if (!config.googleSheets.enabled) return;

	let content: string;
	try {
		content = await Bun.file(csvPath).text();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			logger.info("No daily average data to sync");
			return;
		}
		throw error;
	}

	const records = parseDailyAverageCsv(content);

	if (records.length === 0) {
		logger.info("No daily average data to sync");
		return;
	}

	const googleSheets = createSheetAccessor(
		config.googleSheets.spreadsheetId,
		config.googleSheets.dailyAverageSheetName,
		config.googleSheets.serviceAccountKeyPath,
		dailyAverageColumnDef,
	);

	logger.info(`Parsed ${records.length} valid daily average records`);
	logger.info(
		"Replacing all Google Sheets daily average data with sorted CSV data...",
	);
	await googleSheets.replaceAll(records);
	logger.info("Daily average sync completed - all data replaced and sorted");
}

/**
 * @description メイン処理
 */
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

		logger.info("Syncing player data...");
		await syncPlayerData(config.output.csvFilePath);

		logger.info("Syncing daily averages...");
		await syncDailyAverages(config.output.dailyAverageCsvFilePath);

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
