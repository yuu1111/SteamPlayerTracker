import type { CronController } from "bun";
import { config } from "../config/config";
import { CsvWriter } from "../services/csvWriter";
import { GoogleSheetsService } from "../services/googleSheets";
import { SteamApiService } from "../services/steamApi";
import type { PlayerDataRecord } from "../types/config";
import { createLogger } from "../utils/logger";
import { RetryHandler } from "../utils/retry";

const logger = createLogger("collect-data");

async function collectAndSaveData(): Promise<void> {
	const steamApi = new SteamApiService();
	const csvWriter = new CsvWriter(config.output.csvFilePath);
	const retryHandler = new RetryHandler(
		config.retry.maxRetries,
		config.retry.baseDelay,
	);

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

		if (config.googleSheets.enabled) {
			const gs = config.googleSheets;
			const googleSheets = new GoogleSheetsService(
				gs.spreadsheetId,
				gs.sheetName,
				gs.serviceAccountKeyPath,
			);
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
