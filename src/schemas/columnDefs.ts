import type { SheetColumnDef } from "../services/googleSheets";

/**
 * @description プレイヤーデータ用の列定義
 */
export const playerDataColumnDef: SheetColumnDef<{
	timestamp: string;
	playerCount: number;
}> = {
	headers: ["timestamp (UTC)", "player_count"],
	columnRange: "A:B",
	toRow: (r) => [r.timestamp, r.playerCount],
	getKey: (r) => r.timestamp,
};

/**
 * @description 日次平均データ用の列定義
 */
export const dailyAverageColumnDef: SheetColumnDef<{
	date: string;
	averagePlayerCount: number;
	sampleCount: number;
	maxPlayerCount?: number | undefined;
	maxPlayerTimestamp?: string | undefined;
	minPlayerCount?: number | undefined;
	minPlayerTimestamp?: string | undefined;
}> = {
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
		r.maxPlayerCount ?? "",
		r.maxPlayerTimestamp ?? "",
		r.minPlayerCount ?? "",
		r.minPlayerTimestamp ?? "",
	],
	getKey: (r) => r.date,
};
