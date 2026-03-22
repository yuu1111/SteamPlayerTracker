import type { CronController } from "bun";
import type { PlayerDataRow } from "../schemas/csv";
import { getServices } from "../services/container";
import * as steamApi from "../services/steamApi";

/**
 * @description プレイヤーデータを収集してCSV/Sheetsに保存
 */
async function collectAndSaveData(): Promise<void> {
	const { config, logger, csvWriter, retryHandler, queuedGoogleSheets } =
		getServices();

	try {
		logger.info("Starting data collection...");

		const playerCount = await retryHandler.executeWithRetry(
			() => steamApi.getCurrentPlayerCount(config.steam.appId),
			"Steam API data collection",
		);

		const record: PlayerDataRow = {
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

		if (queuedGoogleSheets) {
			savePromises.push(queuedGoogleSheets.addPlayerRecord(record));
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

export { collectAndSaveData };

export default {
	async scheduled(_controller: CronController) {
		await collectAndSaveData();
	},
};
