import type { CronController } from "bun";
import { config } from "../config";
import { createDatabase } from "../db";
import { createLogger } from "../logger";
import { retry } from "../retry";
import { steamPlayerCountResponseSchema } from "../schemas/steamApi";

const logger = createLogger("collect-data");
const db = createDatabase(config.storage.dbPath);

/**
 * @description Steam APIから現在のプレイヤー数を取得
 */
async function fetchPlayerCount(): Promise<number> {
	const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${config.steam.appId}`;

	const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
	if (!response.ok) {
		throw new Error(`Steam API error: ${response.status}`);
	}

	const data = await response.json();
	const count =
		steamPlayerCountResponseSchema.parse(data).response.player_count;

	if (count === 0) {
		throw new Error(
			"Steam API returned 0 players - treating as failed request",
		);
	}
	return count;
}

/**
 * @description プレイヤーデータを収集してSQLiteに保存
 */
export async function collectData(): Promise<void> {
	try {
		logger.info("Starting data collection...");

		const playerCount = await retry(fetchPlayerCount);

		const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
		db.insertPlayerData(timestamp, playerCount);

		logger.info("Data collection completed", { timestamp, playerCount });
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
