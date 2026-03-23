import { config } from "./config";
import { createDatabase } from "./db";
import { collectData } from "./jobs/collectData";
import { calculateAndSaveDailyAverages } from "./jobs/dailyAverage";
import { createLogger } from "./logger";
import { createRetryHandler } from "./retry";
import { createSteamApiClient } from "./steamApi";

/**
 * @description Windowsでウィンドウタイトルを設定
 * @param title - タイトル文字列
 */
function setWindowTitle(title: string) {
	if (process.platform === "win32") {
		process.title = title;
	}
}

/**
 * @description トラッカーを起動
 */
async function startTracker(): Promise<void> {
	const logger = createLogger("main");
	const db = createDatabase(config.storage.dbPath);
	const steamApi = createSteamApiClient(config.steam.appId);
	const retryHandler = createRetryHandler(config.retry);

	const cronJobNames: string[] = [];
	let gameName: string | undefined;

	/**
	 * @description ウィンドウタイトルをプレイヤー数で更新
	 * @param playerCount - 現在のプレイヤー数
	 */
	function updateWindowTitle(playerCount?: number): void {
		if (process.platform !== "win32") return;

		let title = "Steam Player Tracker";
		if (gameName && playerCount !== undefined) {
			title += ` - ${gameName}: ${playerCount.toLocaleString()} players`;
		} else if (gameName) {
			title += ` - ${gameName}`;
		} else {
			title += " - Running";
		}
		process.title = title;
	}

	/**
	 * @description 登録済みcronジョブを削除
	 */
	async function removeCronJobs(): Promise<void> {
		for (const name of cronJobNames) {
			try {
				await Bun.cron.remove(name);
			} catch (_error) {
				// ignore
			}
		}
	}

	try {
		logger.info("Steam Player Tracker starting...", {
			appId: config.steam.appId,
			dbPath: config.storage.dbPath,
			scheduledMinutes: config.scheduling.collectionMinutes,
			googleSheetsEnabled: config.googleSheets.enabled || false,
		});

		// 設定検証
		logger.info("Validating configuration...");
		const testCount = await retryHandler.executeWithRetry(
			() => steamApi.getCurrentPlayerCount(),
			"Steam API test",
		);
		logger.info("Configuration validated", { testPlayerCount: testCount });

		// ゲーム名取得
		try {
			const name = await steamApi.getGameName();
			if (name) {
				gameName = name;
				logger.info(`Detected game: ${gameName}`);
				updateWindowTitle();
			}
		} catch (_error) {
			// ゲーム名取得失敗は非致命的
		}

		// 起動時データ収集
		logger.info("Collecting initial data...");
		await collectData();

		// 欠落日次平均チェック
		await calculateAndSaveDailyAverages();

		// Bun.cron 登録: データ収集
		const collectWorker = "./jobs/collectData.ts";
		for (const minute of config.scheduling.collectionMinutes) {
			const name = `steam-tracker-collect-${minute}`;
			await Bun.cron(collectWorker, `${minute} * * * *`, name);
			cronJobNames.push(name);
			logger.info(`Registered cron: ${name} (${minute} * * * *)`);
		}

		// Bun.cron 登録: 日次平均
		{
			const dailyWorker = "./jobs/dailyAverage.ts";
			const name = "steam-tracker-daily-avg";
			await Bun.cron(
				dailyWorker,
				`0 ${config.scheduling.dailyAverageHour} * * *`,
				name,
			);
			cronJobNames.push(name);
			logger.info(
				`Registered cron: ${name} (0 ${config.scheduling.dailyAverageHour} * * *)`,
			);
		}

		// Bun.cron 登録: Google Sheets同期
		if (config.googleSheets.enabled) {
			const syncWorker = "./jobs/syncSheets.ts";
			for (const minute of config.scheduling.sheetsSyncMinutes) {
				const name = `steam-tracker-sync-sheets-${minute}`;
				await Bun.cron(syncWorker, `${minute} * * * *`, name);
				cronJobNames.push(name);
				logger.info(`Registered cron: ${name} (${minute} * * * *)`);
			}
		}

		// グレースフルシャットダウン
		const shutdown = async (signal: string) => {
			logger.info(`Received ${signal}. Shutting down...`);
			await removeCronJobs();
			db.close();
			logger.info("Steam Player Tracker stopped");
			process.exit(0);
		};

		process.on("SIGINT", () => shutdown("SIGINT"));
		process.on("SIGTERM", () => shutdown("SIGTERM"));

		logger.info("Steam Player Tracker started successfully");
		console.log("Steam Player Tracker is running!");
		console.log(`Tracking App ID: ${config.steam.appId}`);
		console.log(`Database: ${config.storage.dbPath}`);
		console.log(
			`Collection schedule: every hour at minutes ${config.scheduling.collectionMinutes.join(", ")}`,
		);
		console.log(
			`Google Sheets: ${config.googleSheets.enabled ? "enabled" : "disabled"}`,
		);
		console.log("Press Ctrl+C to stop");
	} catch (error) {
		logger.error("Failed to start Steam Player Tracker", {
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
	try {
		setWindowTitle("Steam Player Tracker - Starting...");
		await startTracker();
		setWindowTitle("Steam Player Tracker - Running");
	} catch (error) {
		setWindowTitle("Steam Player Tracker - Error");
		console.error(
			"Fatal error:",
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}
}

main();
