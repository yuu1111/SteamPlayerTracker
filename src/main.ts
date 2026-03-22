import { config } from "./config/config";
import { createCsvWriter } from "./services/csvWriter";
import { createDailyAverageService } from "./services/dailyAverageService";
import { createGoogleSheetsService } from "./services/googleSheets";
import { createQueuedGoogleSheetsService } from "./services/queuedGoogleSheets";
import * as steamApi from "./services/steamApi";
import type { PlayerDataRecord } from "./types/config";
import { createLogger } from "./utils/logger";
import { createRetryHandler } from "./utils/retry";

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
	const logger = createLogger("SteamPlayerTracker");
	const csvWriter = createCsvWriter(config.output.csvFilePath);
	const retryHandler = createRetryHandler({
		maxRetries: config.retry.maxRetries,
		baseDelay: config.retry.baseDelay,
	});

	let queuedGoogleSheets:
		| ReturnType<typeof createQueuedGoogleSheetsService>
		| undefined;
	let dailyAverageService:
		| ReturnType<typeof createDailyAverageService>
		| undefined;
	let gameName: string | undefined;
	const cronJobNames: string[] = [];

	if (config.googleSheets.enabled) {
		const gs = config.googleSheets;
		const googleSheets = createGoogleSheetsService(
			gs.spreadsheetId,
			gs.sheetName,
			gs.serviceAccountKeyPath,
		);

		const dailyAverageGoogleSheets = config.output.dailyAverageCsvEnabled
			? createGoogleSheetsService(
					gs.spreadsheetId,
					gs.dailyAverageSheetName,
					gs.serviceAccountKeyPath,
				)
			: undefined;

		queuedGoogleSheets = createQueuedGoogleSheetsService(
			googleSheets,
			dailyAverageGoogleSheets,
			logger,
		);
	}

	if (config.output.dailyAverageCsvEnabled) {
		dailyAverageService = createDailyAverageService(
			config.output.csvFilePath,
			config.output.dailyAverageCsvFilePath,
			logger,
			queuedGoogleSheets,
		);
	}

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
	 * @description Steam APIへのテストリクエストで設定を検証
	 */
	async function validateConfiguration(): Promise<void> {
		try {
			logger.info("Validating configuration...");

			const playerCount = await retryHandler.executeWithRetry(
				() => steamApi.getCurrentPlayerCount(config.steam.appId),
				"Steam API test",
			);

			logger.info("Configuration validated successfully", {
				testPlayerCount: playerCount,
			});
		} catch (error) {
			throw new Error(
				`Configuration validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * @description プレイヤーデータを収集してCSV/Sheetsに保存
	 */
	async function collectAndSaveData(): Promise<void> {
		try {
			logger.info("Starting data collection...");

			const playerCount = await retryHandler.executeWithRetry(
				() => steamApi.getCurrentPlayerCount(config.steam.appId),
				"Steam API data collection",
			);

			updateWindowTitle(playerCount);

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

			if (config.googleSheets.enabled && queuedGoogleSheets) {
				savePromises.push(queuedGoogleSheets.addPlayerRecord(record));
			}

			await Promise.all(savePromises);

			logger.info("Data collection completed successfully", {
				timestamp: record.timestamp,
				playerCount: record.playerCount,
				csvSaved: config.output.csvEnabled,
				sheetsSaved: config.googleSheets.enabled || false,
			});
		} catch (error) {
			logger.error("Data collection failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * @description Bun.cronジョブを登録
	 */
	async function registerCronJobs(): Promise<void> {
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

	/**
	 * @description シグナルハンドラでグレースフルシャットダウンを設定
	 */
	function setupGracefulShutdown(): void {
		const shutdown = async (signal: string) => {
			logger.info(`Received ${signal}. Shutting down gracefully...`);

			queuedGoogleSheets?.dispose();
			await removeCronJobs();

			logger.info("Steam Player Tracker stopped");
			process.exit(0);
		};

		process.on("SIGINT", () => shutdown("SIGINT"));
		process.on("SIGTERM", () => shutdown("SIGTERM"));
	}

	// 起動シーケンス
	try {
		logger.info("Steam Player Tracker starting...", {
			appId: config.steam.appId,
			scheduledMinutes: config.scheduling.collectionMinutes,
			csvEnabled: config.output.csvEnabled,
			googleSheetsEnabled: config.googleSheets.enabled || false,
		});

		await validateConfiguration();

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

		logger.info("Collecting initial data on startup...");
		await collectAndSaveData();

		if (config.output.dailyAverageCsvEnabled && dailyAverageService) {
			logger.info("Checking for missing daily averages...");
			await dailyAverageService.checkAndCalculateMissingAverages();
		}

		await registerCronJobs();
		setupGracefulShutdown();

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
