import { getServices } from "./services/container";
import * as steamApi from "./services/steamApi";
import { collectAndSaveData } from "./workers/collect-data";

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
 * @description トラッカーを起動して全サービスを組み立て実行
 */
async function startTracker(): Promise<void> {
	const {
		config,
		logger,
		retryHandler,
		queuedGoogleSheets,
		dailyAverageService,
	} = getServices();

	let gameName: string | undefined;
	const cronJobNames: string[] = [];

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
				logger.info(`Removed cron job: ${name}`);
			} catch (error) {
				logger.warn(`Failed to remove cron job: ${name}`, {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		cronJobNames.length = 0;
	}

	try {
		logger.info("Steam Player Tracker starting...", {
			appId: config.steam.appId,
			scheduledMinutes: config.scheduling.collectionMinutes,
			csvEnabled: config.output.csvEnabled,
			googleSheetsEnabled: config.googleSheets.enabled || false,
		});

		// 設定検証
		logger.info("Validating configuration...");
		const testCount = await retryHandler.executeWithRetry(
			() => steamApi.getCurrentPlayerCount(config.steam.appId),
			"Steam API test",
		);
		logger.info("Configuration validated successfully", {
			testPlayerCount: testCount,
		});

		// ゲーム名取得
		try {
			const name = await steamApi.getGameName(config.steam.appId);
			if (name) {
				gameName = name;
				logger.info(`Detected game: ${gameName}`);
				updateWindowTitle();
			}
		} catch (error) {
			logger.warn("Failed to get game name", {
				error: error instanceof Error ? error.message : String(error),
			});
		}

		// 起動時データ収集(worker と同じコードパス)
		logger.info("Collecting initial data on startup...");
		await collectAndSaveData();

		// 欠落日次平均チェック
		if (config.output.dailyAverageCsvEnabled && dailyAverageService) {
			logger.info("Checking for missing daily averages...");
			await dailyAverageService.checkAndCalculateMissingAverages();
		}

		// Bun.cron 登録
		const collectWorker = "./workers/collect-data.ts";
		const dailyWorker = "./workers/daily-average.ts";

		for (const minute of config.scheduling.collectionMinutes) {
			const cronExpr = `${minute} * * * *`;
			const name = `steam-tracker-collect-${minute}`;
			await Bun.cron(collectWorker, cronExpr, name);
			cronJobNames.push(name);
			logger.info(`Registered cron job: ${name} (${cronExpr})`);
		}

		if (config.output.dailyAverageCsvEnabled) {
			const cronExpr = `0 ${config.scheduling.dailyAverageHour} * * *`;
			const name = "steam-tracker-daily-avg";
			await Bun.cron(dailyWorker, cronExpr, name);
			cronJobNames.push(name);
			logger.info(`Registered cron job: ${name} (${cronExpr})`);
		}

		// グレースフルシャットダウン
		const shutdown = async (signal: string) => {
			logger.info(`Received ${signal}. Shutting down gracefully...`);
			queuedGoogleSheets?.dispose();
			await removeCronJobs();
			logger.info("Steam Player Tracker stopped");
			process.exit(0);
		};

		process.on("SIGINT", () => shutdown("SIGINT"));
		process.on("SIGTERM", () => shutdown("SIGTERM"));

		logger.info("Steam Player Tracker started successfully");
		console.log("Steam Player Tracker is running!");
		console.log(`Tracking App ID: ${config.steam.appId}`);
		console.log(
			`Collection schedule: every hour at minutes ${config.scheduling.collectionMinutes.join(", ")}`,
		);
		console.log(
			`CSV output: ${config.output.csvEnabled ? config.output.csvFilePath : "disabled"}`,
		);
		console.log(
			`Google Sheets: ${config.googleSheets.enabled ? "enabled" : "disabled"}`,
		);
		console.log(
			`Daily averages: ${config.output.dailyAverageCsvEnabled ? `enabled (calculated at ${config.scheduling.dailyAverageHour}:00)` : "disabled"}`,
		);
		if (config.googleSheets.enabled) {
			console.log(
				"Manual sync: run 'bun run sync-google-sheets' to sync CSV data",
			);
		}
		console.log("Press Ctrl+C to stop");
	} catch (error) {
		logger.error("Failed to start Steam Player Tracker", {
			error: error instanceof Error ? error.message : String(error),
		});
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
