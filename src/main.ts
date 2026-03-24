import { config } from "./config";
import { createDatabase } from "./db";
import { collectData, fetchPlayerCount } from "./jobs/collectData";
import { calculateAndSaveDailyAverages } from "./jobs/dailyAverage";
import { syncUnsyncedToSheets } from "./jobs/syncSheets";
import { createLogger } from "./logger";
import { retry } from "./retry";
import { steamAppDetailsSchema } from "./schemas/steamApi";

/**
 * @description トラッカーを起動
 */
async function startTracker(): Promise<void> {
	const logger = createLogger("main");
	const db = createDatabase(config.storage.dbPath);

	const timers: ReturnType<typeof setInterval>[] = [];

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

		// 毎分チェック: 該当分にジョブを実行
		const timer = setInterval(async () => {
			const now = new Date();
			const minute = now.getUTCMinutes();
			const hour = now.getUTCHours();

			// データ収集
			if (config.scheduling.collectionMinutes.includes(minute)) {
				await collectData();
			}

			// 日次平均 (指定時刻の0分)
			if (hour === config.scheduling.dailyAverageHour && minute === 0) {
				await calculateAndSaveDailyAverages();
			}

			// Google Sheets同期
			if (
				config.googleSheets.enabled &&
				config.scheduling.sheetsSyncMinutes.includes(minute)
			) {
				await syncUnsyncedToSheets();
			}
		}, 60_000);
		timers.push(timer);

		// グレースフルシャットダウン
		const shutdown = (signal: string) => {
			logger.info(`Received ${signal}. Shutting down...`);
			for (const t of timers) clearInterval(t);
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
		for (const t of timers) clearInterval(t);
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
