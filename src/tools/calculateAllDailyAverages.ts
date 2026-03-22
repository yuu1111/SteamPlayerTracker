import { promises as fs } from "node:fs";
import { config } from "../config/config";
import { DailyAverageService } from "../services/dailyAverageService";
import { GoogleSheetsService } from "../services/googleSheets";
import { createLogger } from "../utils/logger";

async function calculateAllDailyAverages() {
	const logger = createLogger("calculate-daily-averages");

	try {
		logger.info("Starting calculation of all daily averages...");

		const dailyAverageService = new DailyAverageService(
			config.output.csvFilePath,
			config.output.dailyAverageCsvFilePath,
			logger,
		);

		await dailyAverageService.updateAllDailyAverages();

		if (config.googleSheets.enabled && config.output.dailyAverageCsvEnabled) {
			logger.info("Starting bulk upload to Google Sheets...");

			const dailyAverageGoogleSheets = new GoogleSheetsService(
				config.googleSheets.spreadsheetId,
				config.googleSheets.dailyAverageSheetName,
				config.googleSheets.serviceAccountKeyPath,
			);

			const csvContent = await fs.readFile(
				config.output.dailyAverageCsvFilePath,
				"utf8",
			);
			const lines = csvContent.trim().split("\n");

			if (lines.length <= 1) {
				logger.warn("No daily average data to upload to Google Sheets");
			} else {
				const headerLine = lines[0];
				const header = headerLine ? headerLine.split(",") : [];
				const hasExtendedData = header.length > 3;

				const records = [];
				for (let i = 1; i < lines.length; i++) {
					const line = lines[i];
					if (!line) continue;

					const row = line.split(",");

					if (row.length >= 3) {
						const timestamp = row[0]?.trim() ?? "";
						const playerCount = Number.parseInt(row[1]?.trim() ?? "", 10);
						const sampleCount = Number.parseInt(row[2]?.trim() ?? "", 10);

						if (!Number.isNaN(playerCount) && !Number.isNaN(sampleCount)) {
							records.push({
								timestamp,
								playerCount,
								sampleCount,
								maxPlayerCount:
									hasExtendedData && row[3]
										? Number.parseInt(row[3].trim(), 10)
										: undefined,
								maxPlayerTimestamp:
									hasExtendedData && row[4] ? row[4].trim() : undefined,
								minPlayerCount:
									hasExtendedData && row[5]
										? Number.parseInt(row[5].trim(), 10)
										: undefined,
								minPlayerTimestamp:
									hasExtendedData && row[6] ? row[6].trim() : undefined,
							});
						}
					}
				}

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
