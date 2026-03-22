import { config } from "../config";
import type { DailyAverageRow } from "../schemas/csv";
import { createLogger } from "../utils/logger";
import { createRetryHandler } from "../utils/retry";
import { createCsvWriter } from "./csvWriter";
import { createDailyAverageService } from "./dailyAverageService";
import {
	createSheetAccessor,
	dailyAverageColumnDef,
	playerDataColumnDef,
	type SheetAccessor,
} from "./googleSheets";
import { createQueuedGoogleSheetsService } from "./queuedGoogleSheets";

/**
 * @description アプリケーション全体で共有されるサービス群の型
 */
export interface Services {
	config: typeof config;
	logger: ReturnType<typeof createLogger>;
	csvWriter: ReturnType<typeof createCsvWriter>;
	retryHandler: ReturnType<typeof createRetryHandler>;
	queuedGoogleSheets:
		| ReturnType<typeof createQueuedGoogleSheetsService>
		| undefined;
	dailyAverageGoogleSheets: SheetAccessor<DailyAverageRow> | undefined;
	dailyAverageService: ReturnType<typeof createDailyAverageService> | undefined;
}

let cached: Services;

/**
 * @description サービスコンテナを取得(遅延初期化 + シングルトン)
 * @returns 全サービスを持つオブジェクト
 */
export function getServices(): Services {
	if (cached) return cached;

	const logger = createLogger("SteamPlayerTracker");
	const csvWriter = createCsvWriter(config.output.csvFilePath);
	const retryHandler = createRetryHandler({
		maxRetries: config.retry.maxRetries,
		baseDelay: config.retry.baseDelay,
	});

	let queuedGoogleSheets:
		| ReturnType<typeof createQueuedGoogleSheetsService>
		| undefined;
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

	let dailyAverageService:
		| ReturnType<typeof createDailyAverageService>
		| undefined;

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
		csvWriter,
		retryHandler,
		queuedGoogleSheets,
		dailyAverageGoogleSheets,
		dailyAverageService,
	};

	return cached;
}
