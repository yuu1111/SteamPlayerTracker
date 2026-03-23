import type winston from "winston";
import { config } from "../config/config";
import {
	dailyAverageColumnDef,
	playerDataColumnDef,
} from "../schemas/columnDefs";
import type { Config } from "../schemas/config";
import type { DailyAverageRow } from "../schemas/csv";
import { createLogger } from "../utils/logger";
import type { RetryHandler } from "../utils/retry";
import { createRetryHandler } from "../utils/retry";
import type { CsvWriter } from "./csvWriter";
import { createCsvWriter } from "./csvWriter";
import type { DailyAverageService } from "./dailyAverageService";
import { createDailyAverageService } from "./dailyAverageService";
import { createSheetAccessor, type SheetAccessor } from "./googleSheets";
import type { QueuedGoogleSheetsService } from "./queuedGoogleSheets";
import { createQueuedGoogleSheetsService } from "./queuedGoogleSheets";
import type { SteamApiClient } from "./steamApi";
import { createSteamApiClient } from "./steamApi";

/**
 * @description アプリケーション全体で共有されるサービス群の型
 */
export interface Services {
	config: Config;
	logger: winston.Logger;
	steamApi: SteamApiClient;
	csvWriter: CsvWriter;
	retryHandler: RetryHandler;
	queuedGoogleSheets: QueuedGoogleSheetsService | undefined;
	dailyAverageGoogleSheets: SheetAccessor<DailyAverageRow> | undefined;
	dailyAverageService: DailyAverageService | undefined;
}

let cached: Services;

/**
 * @description サービスコンテナを取得(遅延初期化 + シングルトン)
 * @returns 全サービスを持つオブジェクト
 */
export function getServices(): Services {
	if (cached) return cached;

	const logger = createLogger("SteamPlayerTracker");
	const steamApi = createSteamApiClient(config.steam.appId);
	const csvWriter = createCsvWriter(config.output.csvFilePath);
	const retryHandler = createRetryHandler({
		maxRetries: config.retry.maxRetries,
		baseDelay: config.retry.baseDelay,
	});

	let queuedGoogleSheets: QueuedGoogleSheetsService | undefined;
	let dailyAverageGoogleSheets: SheetAccessor<DailyAverageRow> | undefined;

	if (config.googleSheets.enabled) {
		const gs = config.googleSheets;
		const playerSheets = createSheetAccessor(
			gs.spreadsheetId,
			gs.sheetName,
			gs.serviceAccountKeyPath,
			playerDataColumnDef,
		);

		if (config.output.dailyAverageCsvEnabled) {
			dailyAverageGoogleSheets = createSheetAccessor(
				gs.spreadsheetId,
				gs.dailyAverageSheetName,
				gs.serviceAccountKeyPath,
				dailyAverageColumnDef,
			);
		}

		queuedGoogleSheets = createQueuedGoogleSheetsService(
			playerSheets,
			dailyAverageGoogleSheets,
			logger,
		);
	}

	let dailyAverageService: DailyAverageService | undefined;

	if (config.output.dailyAverageCsvEnabled) {
		dailyAverageService = createDailyAverageService(
			config.output.csvFilePath,
			config.output.dailyAverageCsvFilePath,
			logger,
			queuedGoogleSheets,
		);
	}

	cached = {
		config,
		logger,
		steamApi,
		csvWriter,
		retryHandler,
		queuedGoogleSheets,
		dailyAverageGoogleSheets,
		dailyAverageService,
	};

	return cached;
}
