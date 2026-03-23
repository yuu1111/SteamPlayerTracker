import type { CronController } from "bun";
import { config } from "../config";
import { createDatabase } from "../db";
import { createLogger } from "../logger";
import { createRetryHandler } from "../retry";
import { createSteamApiClient } from "../steamApi";

const logger = createLogger("collect-data");
const db = createDatabase(config.storage.dbPath);
const steamApi = createSteamApiClient(config.steam.appId);
const retryHandler = createRetryHandler(config.retry);

/**
 * @description プレイヤーデータを収集してSQLiteに保存
 */
export async function collectData(): Promise<void> {
	try {
		logger.info("Starting data collection...");

		const playerCount = await retryHandler.executeWithRetry(
			() => steamApi.getCurrentPlayerCount(),
			"Steam API data collection",
		);

		const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
		db.insertPlayerData(timestamp, playerCount);

		logger.info("Data collection completed", {
			timestamp,
			playerCount,
		});
	} catch (error) {
		logger.error("Data collection failed", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export default {
	async scheduled(_controller: CronController) {
		await collectData();
	},
};
