import { config } from "./config";
import { createDatabase } from "./db";
import { collectData } from "./jobs/collectData";
import { calculateAndSaveDailyAverages } from "./jobs/dailyAverage";
import { createLogger } from "./logger";
import { retry } from "./retry";
import {
	steamAppDetailsSchema,
	steamPlayerCountResponseSchema,
} from "./schemas/steamApi";

/**
 * @description トラッカーを起動
 */
async function startTracker(): Promise<void> {
	const logger = createLogger("main");
	const db = createDatabase(config.storage.dbPath);

	const cronJobNames: string[] = [];

	/**
	 * @description 登録済みcronジョブを削除
	 */
	async function removeCronJobs(): Promise<void> {
		for (const name of cronJobNames) {
			try {
				await Bun.cron.remove(name);
			} catch (_error) {
				// シャットダウン中のcron削除失敗は無視
			}
		}
	}

	try {
		logger.info("Steam Player Tracker starting...", {
			appId: config.steam.appId,
			dbPath: config.storage.dbPath,
		});

		// 設定検証
		const testCount = await retry(async () => {
			const res = await fetch(
				`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${config.steam.appId}`,
				{ signal: AbortSignal.timeout(10000) },
			);
			if (!res.ok) throw new Error(`Steam API error: ${res.status}`);
			return steamPlayerCountResponseSchema.parse(await res.json()).response
				.player_count;
		});
		logger.info("Configuration validated", { testPlayerCount: testCount });

		// ゲーム名取得 - 失敗しても起動は継続
		try {
			const res = await fetch(
				`https://store.steampowered.com/api/appdetails?appids=${config.steam.appId}&filters=basic`,
				{ signal: AbortSignal.timeout(10000) },
			);
			if (res.ok) {
				const data = (await res.json()) as Record<string, unknown>;
				const parsed = steamAppDetailsSchema.safeParse(
					data[String(config.steam.appId)],
				);
				if (parsed.success) {
					logger.info(`Detected game: ${parsed.data.data.name}`);
				}
			}
		} catch (_error) {
			logger.debug("Failed to fetch game name");
		}

		// 起動時データ収集
		await collectData();

		// 欠落日次平均チェック
		await calculateAndSaveDailyAverages();

		// Bun.cron 登録: データ収集
		const collectWorker = "./jobs/collectData.ts";
		for (const minute of config.scheduling.collectionMinutes) {
			const name = `steam-tracker-collect-${minute}`;
			await Bun.cron(collectWorker, `${minute} * * * *`, name);
			cronJobNames.push(name);
		}

		// Bun.cron 登録: 日次平均
		{
			const name = "steam-tracker-daily-avg";
			await Bun.cron(
				"./jobs/dailyAverage.ts",
				`0 ${config.scheduling.dailyAverageHour} * * *`,
				name,
			);
			cronJobNames.push(name);
		}

		// Bun.cron 登録: Google Sheets同期
		if (config.googleSheets.enabled) {
			for (const minute of config.scheduling.sheetsSyncMinutes) {
				const name = `steam-tracker-sync-sheets-${minute}`;
				await Bun.cron("./jobs/syncSheets.ts", `${minute} * * * *`, name);
				cronJobNames.push(name);
			}
		}

		// グレースフルシャットダウン
		const shutdown = async (signal: string) => {
			logger.info(`Received ${signal}. Shutting down...`);
			await removeCronJobs();
			db.close();
			process.exit(0);
		};

		process.on("SIGINT", () => shutdown("SIGINT"));
		process.on("SIGTERM", () => shutdown("SIGTERM"));

		console.log("Steam Player Tracker is running!");
		console.log(`Tracking App ID: ${config.steam.appId}`);
		console.log(`Database: ${config.storage.dbPath}`);
		console.log("Press Ctrl+C to stop");
	} catch (error) {
		logger.error("Failed to start", {
			error: error instanceof Error ? error.message : String(error),
		});
		db.close();
		throw error;
	}
}

/**
 * @description エントリーポイント
 */
async function main() {
	if (process.platform === "win32") {
		process.title = "Steam Player Tracker";
	}

	try {
		await startTracker();
	} catch (error) {
		console.error(
			"Fatal error:",
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}
}

main();
