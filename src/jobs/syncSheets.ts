import { config } from "../config";
import type { DailyAverageRow, Database, PlayerDataRow } from "../db";
import { createSheetAccessor, type SheetColumnDef } from "../googleSheets";
import { createLogger } from "../logger";

const logger = createLogger("sync-sheets");

/**
 * @description プレイヤーデータ用の列定義
 */
export const playerDataColumnDef: SheetColumnDef<PlayerDataRow> = {
	headers: ["timestamp (UTC)", "player_count"],
	columnRange: "A:B",
	toRow: (r) => [r.timestamp, r.playerCount],
	getKey: (r) => r.timestamp,
};

/**
 * @description 日次平均データ用の列定義
 */
export const dailyAverageColumnDef: SheetColumnDef<DailyAverageRow> = {
	headers: [
		"date (UTC)",
		"average_player_count",
		"sample_count",
		"max_player_count",
		"max_timestamp (UTC)",
		"min_player_count",
		"min_timestamp (UTC)",
	],
	columnRange: "A:G",
	toRow: (r) => [
		r.date,
		r.averagePlayerCount,
		r.sampleCount,
		r.maxPlayerCount,
		r.maxTimestamp,
		r.minPlayerCount,
		r.minTimestamp,
	],
	getKey: (r) => r.date,
};

/**
 * @description Sheets同期用のアクセサを生成
 */
function createSheetAccessors() {
	const gs = config.googleSheets;
	if (!gs.enabled) throw new Error("Google Sheets is not enabled");
	return {
		playerSheets: createSheetAccessor(
			gs.spreadsheetId,
			gs.sheetName,
			gs.serviceAccountKeyPath,
			playerDataColumnDef,
		),
		dailyAverageSheets: createSheetAccessor(
			gs.spreadsheetId,
			gs.dailyAverageSheetName,
			gs.serviceAccountKeyPath,
			dailyAverageColumnDef,
		),
	};
}

/**
 * @description 未同期レコードをGoogle Sheetsに同期
 * @param db - データベースインスタンス
 */
export async function syncUnsyncedToSheets(db: Database): Promise<void> {
	if (!config.googleSheets.enabled) return;

	const unsyncedPlayers = db.getUnsyncedPlayerData();
	const unsyncedAverages = db.getUnsyncedDailyAverages();

	if (unsyncedPlayers.length === 0 && unsyncedAverages.length === 0) {
		logger.debug("No unsynced records to sync");
		return;
	}

	const { playerSheets, dailyAverageSheets } = createSheetAccessors();

	try {
		if (unsyncedPlayers.length > 0) {
			logger.info(`Syncing ${unsyncedPlayers.length} player records to Sheets`);
			await playerSheets.batchAppend(unsyncedPlayers);
			db.markPlayerDataSynced(unsyncedPlayers.map((r) => r.id));
			logger.info(`Synced ${unsyncedPlayers.length} player records`);
		}

		if (unsyncedAverages.length > 0) {
			logger.info(
				`Syncing ${unsyncedAverages.length} daily average records to Sheets`,
			);
			for (const record of unsyncedAverages) {
				await dailyAverageSheets.append(record);
			}
			db.markDailyAveragesSynced(unsyncedAverages.map((r) => r.date));
			logger.info(`Synced ${unsyncedAverages.length} daily average records`);
		}
	} catch (error) {
		logger.error("Sheets sync failed", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * @description 全データをGoogle Sheetsに完全同期(replaceAll)
 * @param db - データベースインスタンス
 */
export async function fullSyncToSheets(db: Database): Promise<void> {
	if (!config.googleSheets.enabled) {
		logger.error("Google Sheets is not enabled");
		return;
	}

	const { playerSheets, dailyAverageSheets } = createSheetAccessors();

	logger.info("Starting full sync to Google Sheets...");

	const allPlayers = db.getAllPlayerData();
	logger.info(`Replacing all player data (${allPlayers.length} records)...`);
	await playerSheets.replaceAll(allPlayers);

	const allAverages = db.getAllDailyAverages();
	logger.info(
		`Replacing all daily averages (${allAverages.length} records)...`,
	);
	await dailyAverageSheets.replaceAll(allAverages);

	db.markAllPlayerDataSynced();
	db.markAllDailyAveragesSynced();

	logger.info("Full sync completed");
}
