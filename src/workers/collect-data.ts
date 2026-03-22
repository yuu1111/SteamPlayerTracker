import type { CronController } from "bun";
import { config } from "../config/config";
import { createCsvWriter } from "../services/csvWriter";
import { createGoogleSheetsService } from "../services/googleSheets";
import * as steamApi from "../services/steamApi";
import type { PlayerDataRecord } from "../types/config";
import { createLogger } from "../utils/logger";
import { createRetryHandler } from "../utils/retry";

const logger = createLogger("collect-data");
const csvWriter = createCsvWriter(config.output.csvFilePath);
const retryHandler = createRetryHandler({
	maxRetries: config.retry.maxRetries,
	baseDelay: config.retry.baseDelay,
});
const googleSheets = config.googleSheets.enabled
	? createGoogleSheetsService(
			config.googleSheets.spreadsheetId,
			config.googleSheets.sheetName,
			config.googleSheets.serviceAccountKeyPath,
		)
	: null;

async function collectAndSaveData(): Promise<void> {
	try {
		logger.info("Starting data collection...");

		const playerCount = await retryHandler.executeWithRetry(
			() => steamApi.getCurrentPlayerCount(config.steam.appId),
			"Steam API data collection",
		);

		const record: PlayerDataRecord = {
			timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
			playerCount,
		};

		const savePromises: Promise<void>[] = [];

		if (config.output.csvEnabled) {
			savePromises.push(
				retryHandler.executeWithRetry(
					() => csvWriter.writeRecord(record),
					"CSV write",
				),
			);
		}

		if (googleSheets) {
			savePromises.push(googleSheets.appendRecord(record));
		}

		await Promise.all(savePromises);

		logger.info("Data collection completed successfully", {
			timestamp: record.timestamp,
			playerCount: record.playerCount,
			csvSaved: config.output.csvEnabled,
			sheetsSaved: config.googleSheets.enabled,
		});
	} catch (error) {
		logger.error("Data collection failed", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export default {
	async scheduled(_controller: CronController) {
		await collectAndSaveData();
	},
};
