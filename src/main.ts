import { config } from "./config/config";
import { CsvWriter } from "./services/csvWriter";
import { DailyAverageService } from "./services/dailyAverageService";
import { GoogleSheetsService } from "./services/googleSheets";
import { QueuedGoogleSheetsService } from "./services/queuedGoogleSheets";
import { SteamApiService } from "./services/steamApi";
import type { PlayerDataRecord } from "./types/config";
import { createLogger } from "./utils/logger";
import { RetryHandler } from "./utils/retry";

function setWindowTitle(title: string) {
	if (process.platform === "win32") {
		process.title = title;
	}
}

async function main() {
	try {
		setWindowTitle("Steam Player Tracker - Starting...");

		const tracker = new SteamPlayerTracker();

		setWindowTitle("Steam Player Tracker - Running");

		await tracker.start();
	} catch (error) {
		setWindowTitle("Steam Player Tracker - Error");
		console.error(
			"Fatal error:",
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}
}

export class SteamPlayerTracker {
	private steamApi: SteamApiService;
	private csvWriter: CsvWriter;
	private googleSheets: GoogleSheetsService | undefined;
	private dailyAverageGoogleSheets: GoogleSheetsService | undefined;
	private queuedGoogleSheets: QueuedGoogleSheetsService | undefined;
	private dailyAverageService: DailyAverageService | undefined;
	private retryHandler: RetryHandler;
	private logger: ReturnType<typeof createLogger>;
	private gameName: string | undefined;
	private cronJobNames: string[] = [];

	constructor() {
		this.logger = createLogger("SteamPlayerTracker");
		this.steamApi = new SteamApiService();
		this.csvWriter = new CsvWriter(config.output.csvFilePath);
		this.retryHandler = new RetryHandler(
			config.retry.maxRetries,
			config.retry.baseDelay,
		);

		if (config.googleSheets.enabled) {
			const gs = config.googleSheets;
			this.googleSheets = new GoogleSheetsService(
				gs.spreadsheetId,
				gs.sheetName,
				gs.serviceAccountKeyPath,
			);

			if (config.output.dailyAverageCsvEnabled) {
				this.dailyAverageGoogleSheets = new GoogleSheetsService(
					gs.spreadsheetId,
					gs.dailyAverageSheetName,
					gs.serviceAccountKeyPath,
				);
			}

			this.queuedGoogleSheets = new QueuedGoogleSheetsService(
				this.googleSheets,
				this.dailyAverageGoogleSheets,
				this.logger,
			);
		}

		if (config.output.dailyAverageCsvEnabled) {
			this.dailyAverageService = new DailyAverageService(
				config.output.csvFilePath,
				config.output.dailyAverageCsvFilePath,
				this.logger,
				this.queuedGoogleSheets,
			);
		}
	}

	private updateWindowTitle(playerCount?: number): void {
		if (process.platform !== "win32") return;

		let title = "Steam Player Tracker";

		if (this.gameName && playerCount !== undefined) {
			title += ` - ${this.gameName}: ${playerCount.toLocaleString()} players`;
		} else if (this.gameName) {
			title += ` - ${this.gameName}`;
		} else {
			title += " - Running";
		}

		process.title = title;
	}

	async start(): Promise<void> {
		try {
			this.logger.info("Steam Player Tracker starting...", {
				appId: config.steam.appId,
				scheduledMinutes: config.scheduling.collectionMinutes,
				csvEnabled: config.output.csvEnabled,
				googleSheetsEnabled: config.googleSheets.enabled || false,
			});

			await this.validateConfiguration();

			try {
				const gameName = await this.steamApi.getGameName(config.steam.appId);
				if (gameName) {
					this.gameName = gameName;
					this.logger.info(`Detected game: ${this.gameName}`);
					this.updateWindowTitle();
				}
			} catch (error) {
				this.logger.warn("Failed to get game name", {
					error: error instanceof Error ? error.message : String(error),
				});
			}

			this.logger.info("Collecting initial data on startup...");
			await this.collectAndSaveData();

			if (config.output.dailyAverageCsvEnabled && this.dailyAverageService) {
				this.logger.info("Checking for missing daily averages...");
				await this.dailyAverageService.checkAndCalculateMissingAverages();
			}

			await this.registerCronJobs();
			this.setupGracefulShutdown();

			this.logger.info("Steam Player Tracker started successfully");
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
			this.logger.error("Failed to start Steam Player Tracker", {
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	private async registerCronJobs(): Promise<void> {
		const collectWorker = "./workers/collect-data.ts";
		const dailyWorker = "./workers/daily-average.ts";

		for (const minute of config.scheduling.collectionMinutes) {
			const cronExpr = `${minute} * * * *`;
			const name = `steam-tracker-collect-${minute}`;
			await Bun.cron(collectWorker, cronExpr, name);
			this.cronJobNames.push(name);
			this.logger.info(`Registered cron job: ${name} (${cronExpr})`);
		}

		if (config.output.dailyAverageCsvEnabled) {
			const cronExpr = `0 ${config.scheduling.dailyAverageHour} * * *`;
			const name = "steam-tracker-daily-avg";
			await Bun.cron(dailyWorker, cronExpr, name);
			this.cronJobNames.push(name);
			this.logger.info(`Registered cron job: ${name} (${cronExpr})`);
		}
	}

	private async removeCronJobs(): Promise<void> {
		for (const name of this.cronJobNames) {
			try {
				await Bun.cron.remove(name);
				this.logger.info(`Removed cron job: ${name}`);
			} catch (error) {
				this.logger.warn(`Failed to remove cron job: ${name}`, {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		this.cronJobNames = [];
	}

	private async validateConfiguration(): Promise<void> {
		try {
			this.logger.info("Validating configuration...");

			const playerCount = await this.retryHandler.executeWithRetry(
				() => this.steamApi.getCurrentPlayerCount(config.steam.appId),
				"Steam API test",
			);

			this.logger.info("Configuration validated successfully", {
				testPlayerCount: playerCount,
			});
		} catch (error) {
			throw new Error(
				`Configuration validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	private async collectAndSaveData(): Promise<void> {
		try {
			this.logger.info("Starting data collection...");

			const playerCount = await this.retryHandler.executeWithRetry(
				() => this.steamApi.getCurrentPlayerCount(config.steam.appId),
				"Steam API data collection",
			);

			this.updateWindowTitle(playerCount);

			const record: PlayerDataRecord = {
				timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
				playerCount,
			};

			const savePromises: Promise<void>[] = [];

			if (config.output.csvEnabled) {
				savePromises.push(
					this.retryHandler.executeWithRetry(
						() => this.csvWriter.writeRecord(record),
						"CSV write",
					),
				);
			}

			if (config.googleSheets.enabled && this.queuedGoogleSheets) {
				savePromises.push(this.queuedGoogleSheets.addPlayerRecord(record));
			}

			await Promise.all(savePromises);

			this.logger.info("Data collection completed successfully", {
				timestamp: record.timestamp,
				playerCount: record.playerCount,
				csvSaved: config.output.csvEnabled,
				sheetsSaved: config.googleSheets.enabled || false,
			});
		} catch (error) {
			this.logger.error("Data collection failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private setupGracefulShutdown(): void {
		const shutdown = async (signal: string) => {
			this.logger.info(`Received ${signal}. Shutting down gracefully...`);

			this.queuedGoogleSheets?.dispose();
			await this.removeCronJobs();

			this.logger.info("Steam Player Tracker stopped");
			process.exit(0);
		};

		process.on("SIGINT", () => shutdown("SIGINT"));
		process.on("SIGTERM", () => shutdown("SIGTERM"));
	}
}

main();
