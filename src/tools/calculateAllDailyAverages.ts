import { config } from "../config";
import { createDailyAverageService } from "../services/dailyAverageService";
import {
	createSheetAccessor,
	dailyAverageColumnDef,
} from "../services/googleSheets";
import { parseDailyAverageCsv } from "../utils/csv-parser";
import { createLogger } from "../utils/logger";

/**
 * @description 全日次平均を再計算し、オプションでGoogle Sheetsにアップロード
 */
async function calculateAllDailyAverages() {
	const logger = createLogger("calculate-daily-averages");

	try {
		logger.info("Starting calculation of all daily averages...");

		const dailyAverageService = createDailyAverageService(
			config.output.csvFilePath,
			config.output.dailyAverageCsvFilePath,
			logger,
		);

		await dailyAverageService.updateAllDailyAverages();

		if (config.googleSheets.enabled && config.output.dailyAverageCsvEnabled) {
			logger.info("Starting bulk upload to Google Sheets...");

			const googleSheets = createSheetAccessor(
				config.googleSheets.spreadsheetId,
				config.googleSheets.dailyAverageSheetName,
				config.googleSheets.serviceAccountKeyPath,
				dailyAverageColumnDef,
			);

			const csvContent = await Bun.file(
				config.output.dailyAverageCsvFilePath,
			).text();

			const records = parseDailyAverageCsv(csvContent);

			if (records.length === 0) {
				logger.warn("No daily average data to upload to Google Sheets");
			} else {
				logger.info(
					`Uploading ${records.length} daily average records to Google Sheets...`,
				);
				await googleSheets.replaceAll(records);
				logger.info("Bulk upload to Google Sheets completed successfully");
			}
		}

		logger.info("All daily averages calculated successfully");
		console.log("All daily averages have been calculated successfully!");

		process.exit(0);
	} catch (error) {
		logger.error(
			`Failed to calculate daily averages: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		console.error("Failed to calculate daily averages:", error);
		process.exit(1);
	}
}

calculateAllDailyAverages();
