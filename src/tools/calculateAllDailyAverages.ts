import { promises as fs } from "node:fs";
import { config } from "../config/config";
import { createDailyAverageService } from "../services/dailyAverageService";
import { createGoogleSheetsService } from "../services/googleSheets";
import { parseDailyAverageCsv } from "../utils/csv-parser";
import { createLogger } from "../utils/logger";

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

			const dailyAverageGoogleSheets = createGoogleSheetsService(
				config.googleSheets.spreadsheetId,
				config.googleSheets.dailyAverageSheetName,
				config.googleSheets.serviceAccountKeyPath,
			);

			const csvContent = await fs.readFile(
				config.output.dailyAverageCsvFilePath,
				"utf8",
			);

			const avgRecords = parseDailyAverageCsv(csvContent);

			if (avgRecords.length === 0) {
				logger.warn("No daily average data to upload to Google Sheets");
			} else {
				const records = avgRecords.map((r) => ({
					timestamp: r.date,
					playerCount: r.averagePlayerCount,
					sampleCount: r.sampleCount,
					maxPlayerCount: r.maxPlayerCount,
					maxPlayerTimestamp: r.maxPlayerTimestamp,
					minPlayerCount: r.minPlayerCount,
					minPlayerTimestamp: r.minPlayerTimestamp,
				}));

				logger.info(
					`Uploading ${records.length} daily average records to Google Sheets...`,
				);

				await dailyAverageGoogleSheets.replaceAllDailyAverageRecords(records);
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
