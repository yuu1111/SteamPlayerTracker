import { createDatabase, type Database } from "../src/db";

/**
 * @description テスト用のインメモリデータベースを作成
 * @returns db - Databaseインスタンス, cleanup - クローズ関数
 */
export function createTestDatabase(): { db: Database; cleanup: () => void } {
	const db = createDatabase(":memory:");
	return {
		db,
		cleanup: () => db.close(),
	};
}

/**
 * @description テスト用プレイヤーデータを生成
 * @param count - 生成する件数 @default 3
 * @param date - 基準日 @default "2024-01-01"
 */
export function samplePlayerData(count = 3, date = "2024-01-01") {
	return Array.from({ length: count }, (_, i) => ({
		timestamp: `${date} ${String(i).padStart(2, "0")}:00:00`,
		playerCount: 1000 + i * 100,
	}));
}

/**
 * @description テスト用日次平均データを生成
 * @param date - 日付 @default "2024-01-01"
 */
export function sampleDailyAverageRow(date = "2024-01-01") {
	return {
		date,
		averagePlayerCount: 1100,
		sampleCount: 3,
		maxPlayerCount: 1200,
		maxTimestamp: `${date} 02:00:00`,
		minPlayerCount: 1000,
		minTimestamp: `${date} 00:00:00`,
	};
}
