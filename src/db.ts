import { Database as SQLiteDatabase } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * @description プレイヤーデータの行型
 * @property timestamp - ISO形式タイムスタンプ (YYYY-MM-DD HH:mm:ss)
 * @property playerCount - プレイヤー数
 */
export interface PlayerDataRow {
	timestamp: string;
	playerCount: number;
}

/**
 * @description 日次平均の行型
 * @property date - 日付 (YYYY-MM-DD)
 * @property averagePlayerCount - 平均プレイヤー数
 * @property sampleCount - サンプル数
 * @property maxPlayerCount - 最大プレイヤー数
 * @property maxTimestamp - 最大時のタイムスタンプ
 * @property minPlayerCount - 最小プレイヤー数
 * @property minTimestamp - 最小時のタイムスタンプ
 */
export interface DailyAverageRow {
	date: string;
	averagePlayerCount: number;
	sampleCount: number;
	maxPlayerCount: number;
	maxTimestamp: string;
	minPlayerCount: number;
	minTimestamp: string;
}

/**
 * @description データベース操作の公開インターフェース
 */
export interface Database {
	insertPlayerData(timestamp: string, playerCount: number): void;
	getPlayerDataByDateRange(from: string, to: string): PlayerDataRow[];
	getAllPlayerData(): PlayerDataRow[];
	getUnsyncedPlayerData(): {
		id: number;
		timestamp: string;
		playerCount: number;
	}[];
	markPlayerDataSynced(ids: number[]): void;
	markAllPlayerDataSynced(): void;

	calculateDailyAverage(date: string): DailyAverageRow | null;
	upsertDailyAverage(row: DailyAverageRow): void;
	getDailyAverageRange(from: string, to: string): DailyAverageRow[];
	getAllDailyAverages(): DailyAverageRow[];
	getUnsyncedDailyAverages(): DailyAverageRow[];
	markDailyAveragesSynced(dates: string[]): void;
	markAllDailyAveragesSynced(): void;
	getDatesWithDataButNoAverage(): string[];

	close(): void;
	[Symbol.dispose](): void;
}

/**
 * @description SQLiteデータベースを初期化しクエリヘルパーを返す
 * @param dbPath - データベースファイルパス
 */
export function createDatabase(dbPath: string): Database {
	if (dbPath !== ":memory:") {
		mkdirSync(dirname(dbPath), { recursive: true });
	}
	const db = new SQLiteDatabase(dbPath);

	db.run("PRAGMA journal_mode = WAL");
	db.run("PRAGMA foreign_keys = ON");

	db.run(`
		CREATE TABLE IF NOT EXISTS player_data (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp TEXT NOT NULL,
			player_count INTEGER NOT NULL,
			synced_at TEXT
		);
		CREATE INDEX IF NOT EXISTS idx_player_data_timestamp ON player_data(timestamp);
		CREATE INDEX IF NOT EXISTS idx_player_data_unsynced ON player_data(synced_at) WHERE synced_at IS NULL;

		CREATE TABLE IF NOT EXISTS daily_averages (
			date TEXT PRIMARY KEY,
			average_player_count INTEGER NOT NULL,
			sample_count INTEGER NOT NULL,
			max_player_count INTEGER NOT NULL,
			max_timestamp TEXT NOT NULL,
			min_player_count INTEGER NOT NULL,
			min_timestamp TEXT NOT NULL,
			synced_at TEXT
		);
		CREATE INDEX IF NOT EXISTS idx_daily_averages_unsynced ON daily_averages(synced_at) WHERE synced_at IS NULL;
	`);

	const stmts = {
		insertPlayer: db.prepare(
			"INSERT INTO player_data (timestamp, player_count) VALUES (?, ?)",
		),
		playerByDateRange: db.prepare(
			"SELECT timestamp, player_count FROM player_data WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp",
		),
		allPlayer: db.prepare(
			"SELECT timestamp, player_count FROM player_data ORDER BY timestamp",
		),
		unsyncedPlayer: db.prepare(
			"SELECT id, timestamp, player_count FROM player_data WHERE synced_at IS NULL ORDER BY timestamp",
		),
		calcDailyAvg: db.prepare(`
			SELECT
				$date AS date,
				ROUND(AVG(player_count)) AS average_player_count,
				COUNT(*) AS sample_count,
				MAX(player_count) AS max_player_count,
				(SELECT timestamp FROM player_data
				 WHERE date(timestamp) = $date AND player_count > 0
				 ORDER BY player_count DESC, timestamp ASC LIMIT 1) AS max_timestamp,
				MIN(player_count) AS min_player_count,
				(SELECT timestamp FROM player_data
				 WHERE date(timestamp) = $date AND player_count > 0
				 ORDER BY player_count ASC, timestamp ASC LIMIT 1) AS min_timestamp
			FROM player_data
			WHERE date(timestamp) = $date AND player_count > 0
		`),
		upsertDailyAvg: db.prepare(`
			INSERT INTO daily_averages (date, average_player_count, sample_count, max_player_count, max_timestamp, min_player_count, min_timestamp)
			VALUES ($date, $averagePlayerCount, $sampleCount, $maxPlayerCount, $maxTimestamp, $minPlayerCount, $minTimestamp)
			ON CONFLICT(date) DO UPDATE SET
				average_player_count = excluded.average_player_count,
				sample_count = excluded.sample_count,
				max_player_count = excluded.max_player_count,
				max_timestamp = excluded.max_timestamp,
				min_player_count = excluded.min_player_count,
				min_timestamp = excluded.min_timestamp,
				synced_at = NULL
		`),
		dailyAvgByDateRange: db.prepare(
			"SELECT date, average_player_count, sample_count, max_player_count, max_timestamp, min_player_count, min_timestamp FROM daily_averages WHERE date >= ? AND date <= ? ORDER BY date",
		),
		allDailyAvg: db.prepare(
			"SELECT date, average_player_count, sample_count, max_player_count, max_timestamp, min_player_count, min_timestamp FROM daily_averages ORDER BY date",
		),
		unsyncedDailyAvg: db.prepare(
			"SELECT date, average_player_count, sample_count, max_player_count, max_timestamp, min_player_count, min_timestamp FROM daily_averages WHERE synced_at IS NULL ORDER BY date",
		),
		markAllPlayerSynced: db.prepare(
			"UPDATE player_data SET synced_at = ? WHERE synced_at IS NULL",
		),
		markAllDailyAvgSynced: db.prepare(
			"UPDATE daily_averages SET synced_at = ? WHERE synced_at IS NULL",
		),
		datesWithNoAverage: db.prepare(`
			SELECT DISTINCT date(timestamp) AS date FROM player_data
			WHERE player_count > 0
			  AND date(timestamp) < date('now')
			  AND date(timestamp) NOT IN (SELECT date FROM daily_averages)
			ORDER BY date
		`),
	};

	type Row = Record<string, unknown>;

	/**
	 * @description DB行をPlayerDataRowに変換
	 */
	function toPlayerRow(row: Row): PlayerDataRow {
		return {
			timestamp: row.timestamp as string,
			playerCount: row.player_count as number,
		};
	}

	/**
	 * @description DB行をDailyAverageRowに変換
	 */
	function toDailyAvgRow(row: Row): DailyAverageRow {
		return {
			date: row.date as string,
			averagePlayerCount: row.average_player_count as number,
			sampleCount: row.sample_count as number,
			maxPlayerCount: row.max_player_count as number,
			maxTimestamp: row.max_timestamp as string,
			minPlayerCount: row.min_player_count as number,
			minTimestamp: row.min_timestamp as string,
		};
	}

	/**
	 * @description プレイヤーデータを挿入
	 * @param timestamp - タイムスタンプ
	 * @param playerCount - プレイヤー数
	 */
	function insertPlayerData(timestamp: string, playerCount: number): void {
		stmts.insertPlayer.run(timestamp, playerCount);
	}

	/**
	 * @description 日付範囲でプレイヤーデータを取得
	 * @param from - 開始日時 (inclusive)
	 * @param to - 終了日時 (exclusive)
	 */
	function getPlayerDataByDateRange(from: string, to: string): PlayerDataRow[] {
		return (stmts.playerByDateRange.all(from, to) as Row[]).map(toPlayerRow);
	}

	/**
	 * @description 全プレイヤーデータを取得
	 */
	function getAllPlayerData(): PlayerDataRow[] {
		return (stmts.allPlayer.all() as Row[]).map(toPlayerRow);
	}

	/**
	 * @description 未同期のプレイヤーデータを取得
	 */
	function getUnsyncedPlayerData(): {
		id: number;
		timestamp: string;
		playerCount: number;
	}[] {
		return (stmts.unsyncedPlayer.all() as Row[]).map((row) => ({
			id: row.id as number,
			timestamp: row.timestamp as string,
			playerCount: row.player_count as number,
		}));
	}

	/**
	 * @description プレイヤーデータを同期済みに更新
	 * @param ids - 更新対象のID配列
	 */
	function markPlayerDataSynced(ids: number[]): void {
		if (ids.length === 0) return;
		const now = new Date().toISOString();
		const placeholders = ids.map(() => "?").join(",");
		db.prepare(
			`UPDATE player_data SET synced_at = ? WHERE id IN (${placeholders})`,
		).run(now, ...ids);
	}

	/**
	 * @description 全プレイヤーデータを同期済みに更新
	 */
	function markAllPlayerDataSynced(): void {
		stmts.markAllPlayerSynced.run(new Date().toISOString());
	}

	/**
	 * @description 指定日の日次平均をSQLで計算
	 * @param date - 日付 (YYYY-MM-DD)
	 * @returns 計算結果(データがない場合はnull)
	 */
	function calculateDailyAverage(date: string): DailyAverageRow | null {
		const row = stmts.calcDailyAvg.get({ $date: date }) as Row | null;
		if (!row || row.sample_count === 0 || row.max_timestamp === null)
			return null;
		return toDailyAvgRow(row);
	}

	/**
	 * @description 日次平均をupsert
	 * @param row - 日次平均データ
	 */
	function upsertDailyAverage(row: DailyAverageRow): void {
		stmts.upsertDailyAvg.run({
			$date: row.date,
			$averagePlayerCount: row.averagePlayerCount,
			$sampleCount: row.sampleCount,
			$maxPlayerCount: row.maxPlayerCount,
			$maxTimestamp: row.maxTimestamp,
			$minPlayerCount: row.minPlayerCount,
			$minTimestamp: row.minTimestamp,
		});
	}

	/**
	 * @description 日付範囲で日次平均を取得
	 * @param from - 開始日 (inclusive)
	 * @param to - 終了日 (inclusive)
	 */
	function getDailyAverageRange(from: string, to: string): DailyAverageRow[] {
		return (stmts.dailyAvgByDateRange.all(from, to) as Row[]).map(
			toDailyAvgRow,
		);
	}

	/**
	 * @description 全日次平均を取得
	 */
	function getAllDailyAverages(): DailyAverageRow[] {
		return (stmts.allDailyAvg.all() as Row[]).map(toDailyAvgRow);
	}

	/**
	 * @description 未同期の日次平均を取得
	 */
	function getUnsyncedDailyAverages(): DailyAverageRow[] {
		return (stmts.unsyncedDailyAvg.all() as Row[]).map(toDailyAvgRow);
	}

	/**
	 * @description 日次平均を同期済みに更新
	 * @param dates - 更新対象の日付配列
	 */
	function markDailyAveragesSynced(dates: string[]): void {
		if (dates.length === 0) return;
		const now = new Date().toISOString();
		const placeholders = dates.map(() => "?").join(",");
		db.prepare(
			`UPDATE daily_averages SET synced_at = ? WHERE date IN (${placeholders})`,
		).run(now, ...dates);
	}

	/**
	 * @description 全日次平均を同期済みに更新
	 */
	function markAllDailyAveragesSynced(): void {
		stmts.markAllDailyAvgSynced.run(new Date().toISOString());
	}

	/**
	 * @description データはあるが日次平均が未計算の日付を取得
	 */
	function getDatesWithDataButNoAverage(): string[] {
		return (stmts.datesWithNoAverage.all() as Row[]).map(
			(row) => row.date as string,
		);
	}

	/**
	 * @description データベースを閉じる
	 */
	function close(): void {
		db.close();
	}

	return {
		insertPlayerData,
		getPlayerDataByDateRange,
		getAllPlayerData,
		getUnsyncedPlayerData,
		markPlayerDataSynced,
		markAllPlayerDataSynced,
		calculateDailyAverage,
		upsertDailyAverage,
		getDailyAverageRange,
		getAllDailyAverages,
		getUnsyncedDailyAverages,
		markDailyAveragesSynced,
		markAllDailyAveragesSynced,
		getDatesWithDataButNoAverage,
		close,
		[Symbol.dispose]: close,
	};
}
