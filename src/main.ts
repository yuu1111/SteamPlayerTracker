import { config } from "./config";
import { createDatabase } from "./db";
import { collectData, fetchPlayerCount } from "./jobs/collectData";
import { calculateAndSaveDailyAverages } from "./jobs/dailyAverage";
import { createLogger } from "./logger";
import { retry } from "./retry";
import { steamAppDetailsSchema } from "./schemas/steamApi";

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

		// 設定検証 + ゲーム名取得を並列実行
		const [playerCountResult, gameNameResult] = await Promise.allSettled([
			retry(fetchPlayerCount),
			fetch(
				`https://store.steampowered.com/api/appdetails?appids=${config.steam.appId}&filters=basic`,
				{ signal: AbortSignal.timeout(10000) },
			).then(async (res) => {
				if (!res.ok) return null;
				const data = (await res.json()) as Record<string, unknown>;
				const parsed = steamAppDetailsSchema.safeParse(
					data[String(config.steam.appId)],
				);
				return parsed.success ? parsed.data.data.name : null;
			}),
		]);

		if (playerCountResult.status === "rejected") {
			throw playerCountResult.reason;
		}
		logger.info("Configuration validated", {
			testPlayerCount: playerCountResult.value,
		});

		if (
			gameNameResult.status === "fulfilled" &&
			gameNameResult.value !== null
		) {
			logger.info(`Detected game: ${gameNameResult.value}`);
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

		logger.info("Steam Player Tracker is running", {
			appId: config.steam.appId,
			dbPath: config.storage.dbPath,
		});
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
