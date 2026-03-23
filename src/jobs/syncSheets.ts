import type { CronController } from "bun";
import { config } from "../config";
import type { DailyAverageRow, PlayerDataRow } from "../db";
import { createDatabase } from "../db";
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
 * @description 未同期レコードをGoogle Sheetsに同期
 */
async function syncUnsyncedToSheets(): Promise<void> {
	if (!config.googleSheets.enabled) return;

	const db = createDatabase(config.storage.dbPath);
	const gs = config.googleSheets;

	const playerSheets = createSheetAccessor(
		gs.spreadsheetId,
		gs.sheetName,
		gs.serviceAccountKeyPath,
		playerDataColumnDef,
	);
	const dailyAverageSheets = createSheetAccessor(
		gs.spreadsheetId,
		gs.dailyAverageSheetName,
		gs.serviceAccountKeyPath,
		dailyAverageColumnDef,
	);

	try {
		// プレイヤーデータの同期
		const unsyncedPlayers = db.getUnsyncedPlayerData();
		if (unsyncedPlayers.length > 0) {
			logger.info(`Syncing ${unsyncedPlayers.length} player records to Sheets`);
			const records = unsyncedPlayers.map(({ timestamp, playerCount }) => ({
				timestamp,
				playerCount,
			}));
			await playerSheets.batchAppend(records);
			db.markPlayerDataSynced(unsyncedPlayers.map((r) => r.id));
			logger.info(`Synced ${unsyncedPlayers.length} player records`);
		}

		// 日次平均の同期
		const unsyncedAverages = db.getUnsyncedDailyAverages();
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

		if (unsyncedPlayers.length === 0 && unsyncedAverages.length === 0) {
			logger.debug("No unsynced records to sync");
		}
	} catch (error) {
		logger.error("Sheets sync failed", {
			error: error instanceof Error ? error.message : String(error),
		});
	} finally {
		db.close();
	}
}

/**
 * @description 全データをGoogle Sheetsに完全同期(replaceAll)
 */
export async function fullSyncToSheets(): Promise<void> {
	if (!config.googleSheets.enabled) {
		logger.error("Google Sheets is not enabled");
		return;
	}

	const db = createDatabase(config.storage.dbPath);
	const gs = config.googleSheets;

	const playerSheets = createSheetAccessor(
		gs.spreadsheetId,
		gs.sheetName,
		gs.serviceAccountKeyPath,
		playerDataColumnDef,
	);
	const dailyAverageSheets = createSheetAccessor(
		gs.spreadsheetId,
		gs.dailyAverageSheetName,
		gs.serviceAccountKeyPath,
		dailyAverageColumnDef,
	);

	try {
		logger.info("Starting full sync to Google Sheets...");

		const allPlayers = db.getAllPlayerData();
		logger.info(`Replacing all player data (${allPlayers.length} records)...`);
		await playerSheets.replaceAll(allPlayers);

		const allAverages = db.getAllDailyAverages();
		logger.info(
			`Replacing all daily averages (${allAverages.length} records)...`,
		);
		await dailyAverageSheets.replaceAll(allAverages);

		// 全レコードを同期済みに更新
		const playerIds = db.getUnsyncedPlayerData().map((r) => r.id);
		if (playerIds.length > 0) db.markPlayerDataSynced(playerIds);

		const avgDates = db.getUnsyncedDailyAverages().map((r) => r.date);
		if (avgDates.length > 0) db.markDailyAveragesSynced(avgDates);

		logger.info("Full sync completed");
	} finally {
		db.close();
	}
}

export default {
	async scheduled(_controller: CronController) {
		await syncUnsyncedToSheets();
	},
};
