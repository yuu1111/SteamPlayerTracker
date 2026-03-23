import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Database } from "../src/db";
import { createTestDatabase, sampleDailyAverageRow } from "./test-helpers";

describe("createDatabase", () => {
	let db: Database;
	let cleanup: () => void;

	beforeEach(() => {
		({ db, cleanup } = createTestDatabase());
	});

	afterEach(() => {
		cleanup();
	});

	describe("insertPlayerData / getAllPlayerData", () => {
		it("データを挿入して取得できる", () => {
			db.insertPlayerData("2024-01-01 12:00:00", 1000);
			const all = db.getAllPlayerData();
			expect(all).toHaveLength(1);
			expect(all[0]?.timestamp).toBe("2024-01-01 12:00:00");
			expect(all[0]?.playerCount).toBe(1000);
		});

		it("データがない場合は空配列を返す", () => {
			expect(db.getAllPlayerData()).toEqual([]);
		});

		it("timestamp昇順で返す", () => {
			db.insertPlayerData("2024-01-01 03:00:00", 300);
			db.insertPlayerData("2024-01-01 01:00:00", 100);
			db.insertPlayerData("2024-01-01 02:00:00", 200);

			const all = db.getAllPlayerData();
			expect(all.map((r) => r.playerCount)).toEqual([100, 200, 300]);
		});
	});

	describe("getPlayerDataByDateRange", () => {
		it("範囲内のデータのみ返す (from inclusive, to exclusive)", () => {
			db.insertPlayerData("2024-01-01 01:00:00", 100);
			db.insertPlayerData("2024-01-01 02:00:00", 200);
			db.insertPlayerData("2024-01-01 03:00:00", 300);
			db.insertPlayerData("2024-01-01 04:00:00", 400);

			const result = db.getPlayerDataByDateRange(
				"2024-01-01 02:00:00",
				"2024-01-01 04:00:00",
			);
			expect(result).toHaveLength(2);
			expect(result[0]?.playerCount).toBe(200);
			expect(result[1]?.playerCount).toBe(300);
		});

		it("データがない範囲で空配列を返す", () => {
			expect(
				db.getPlayerDataByDateRange(
					"2099-01-01 00:00:00",
					"2099-01-02 00:00:00",
				),
			).toEqual([]);
		});
	});

	describe("getUnsyncedPlayerData / markPlayerDataSynced", () => {
		it("新規挿入データは未同期", () => {
			db.insertPlayerData("2024-01-01 00:00:00", 100);
			db.insertPlayerData("2024-01-01 01:00:00", 200);
			db.insertPlayerData("2024-01-01 02:00:00", 300);

			const unsynced = db.getUnsyncedPlayerData();
			expect(unsynced).toHaveLength(3);
			expect(unsynced[0]).toHaveProperty("id");
			expect(unsynced[0]).toHaveProperty("timestamp");
			expect(unsynced[0]).toHaveProperty("playerCount");
		});

		it("同期済みマーク後は未同期から除外される", () => {
			db.insertPlayerData("2024-01-01 00:00:00", 100);
			db.insertPlayerData("2024-01-01 01:00:00", 200);
			db.insertPlayerData("2024-01-01 02:00:00", 300);

			const unsynced = db.getUnsyncedPlayerData();
			const ids = unsynced.slice(0, 2).map((r) => r.id);
			db.markPlayerDataSynced(ids);

			const remaining = db.getUnsyncedPlayerData();
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.playerCount).toBe(300);
		});

		it("空配列でmarkPlayerDataSyncedはno-op", () => {
			expect(() => db.markPlayerDataSynced([])).not.toThrow();
		});
	});

	describe("calculateDailyAverage", () => {
		it("平均・最大・最小・サンプル数を正しく計算する", () => {
			db.insertPlayerData("2024-01-01 00:00:00", 100);
			db.insertPlayerData("2024-01-01 12:00:00", 200);
			db.insertPlayerData("2024-01-01 18:00:00", 300);

			const result = db.calculateDailyAverage("2024-01-01");
			expect(result).not.toBeNull();
			expect(result?.averagePlayerCount).toBe(200);
			expect(result?.minPlayerCount).toBe(100);
			expect(result?.maxPlayerCount).toBe(300);
			expect(result?.sampleCount).toBe(3);
			expect(result?.minTimestamp).toBe("2024-01-01 00:00:00");
			expect(result?.maxTimestamp).toBe("2024-01-01 18:00:00");
		});

		it("データがない日付でnullを返す", () => {
			expect(db.calculateDailyAverage("2099-01-01")).toBeNull();
		});

		it("player_count=0を除外して計算する", () => {
			db.insertPlayerData("2024-01-01 00:00:00", 0);
			db.insertPlayerData("2024-01-01 01:00:00", 100);
			db.insertPlayerData("2024-01-01 02:00:00", 200);

			const result = db.calculateDailyAverage("2024-01-01");
			expect(result).not.toBeNull();
			expect(result?.sampleCount).toBe(2);
			expect(result?.averagePlayerCount).toBe(150);
		});

		it("全てplayer_count=0の場合nullを返す", () => {
			db.insertPlayerData("2024-01-01 00:00:00", 0);
			db.insertPlayerData("2024-01-01 01:00:00", 0);
			expect(db.calculateDailyAverage("2024-01-01")).toBeNull();
		});
	});

	describe("upsertDailyAverage / getAllDailyAverages", () => {
		it("新規日次平均を挿入する", () => {
			const row = sampleDailyAverageRow("2024-01-01");
			db.upsertDailyAverage(row);

			const all = db.getAllDailyAverages();
			expect(all).toHaveLength(1);
			expect(all[0]?.date).toBe("2024-01-01");
			expect(all[0]?.averagePlayerCount).toBe(1100);
		});

		it("既存日次平均を更新する", () => {
			db.upsertDailyAverage(sampleDailyAverageRow("2024-01-01"));
			db.upsertDailyAverage({
				...sampleDailyAverageRow("2024-01-01"),
				averagePlayerCount: 9999,
			});

			const all = db.getAllDailyAverages();
			expect(all).toHaveLength(1);
			expect(all[0]?.averagePlayerCount).toBe(9999);
		});

		it("upsertでsynced_atがNULLにリセットされる", () => {
			db.upsertDailyAverage(sampleDailyAverageRow("2024-01-01"));
			db.markDailyAveragesSynced(["2024-01-01"]);
			expect(db.getUnsyncedDailyAverages()).toHaveLength(0);

			db.upsertDailyAverage({
				...sampleDailyAverageRow("2024-01-01"),
				averagePlayerCount: 5555,
			});
			expect(db.getUnsyncedDailyAverages()).toHaveLength(1);
		});
	});

	describe("getDailyAverageRange", () => {
		it("日付範囲内の日次平均を返す (inclusive)", () => {
			db.upsertDailyAverage(sampleDailyAverageRow("2024-01-01"));
			db.upsertDailyAverage(sampleDailyAverageRow("2024-01-02"));
			db.upsertDailyAverage(sampleDailyAverageRow("2024-01-03"));

			const result = db.getDailyAverageRange("2024-01-01", "2024-01-02");
			expect(result).toHaveLength(2);
		});
	});

	describe("getUnsyncedDailyAverages / markDailyAveragesSynced", () => {
		it("新規upsertデータは未同期", () => {
			db.upsertDailyAverage(sampleDailyAverageRow("2024-01-01"));
			expect(db.getUnsyncedDailyAverages()).toHaveLength(1);
		});

		it("同期済みマーク後は除外される", () => {
			db.upsertDailyAverage(sampleDailyAverageRow("2024-01-01"));
			db.upsertDailyAverage(sampleDailyAverageRow("2024-01-02"));
			db.markDailyAveragesSynced(["2024-01-01"]);

			const unsynced = db.getUnsyncedDailyAverages();
			expect(unsynced).toHaveLength(1);
			expect(unsynced[0]?.date).toBe("2024-01-02");
		});

		it("空配列でmarkDailyAveragesSyncedはno-op", () => {
			expect(() => db.markDailyAveragesSynced([])).not.toThrow();
		});
	});

	describe("getDatesWithDataButNoAverage", () => {
		it("平均未計算の過去日付を返す", () => {
			db.insertPlayerData("2020-01-01 12:00:00", 100);
			db.insertPlayerData("2020-01-02 12:00:00", 200);
			db.upsertDailyAverage(sampleDailyAverageRow("2020-01-01"));

			const dates = db.getDatesWithDataButNoAverage();
			expect(dates).toContain("2020-01-02");
			expect(dates).not.toContain("2020-01-01");
		});

		it("全日付に平均がある場合は空配列", () => {
			db.insertPlayerData("2020-01-01 12:00:00", 100);
			db.upsertDailyAverage(sampleDailyAverageRow("2020-01-01"));
			expect(db.getDatesWithDataButNoAverage()).toEqual([]);
		});
	});

	describe("close", () => {
		it("エラーなしでcloseできる", () => {
			expect(() => db.close()).not.toThrow();
			// cleanup will try to close again, so create a fresh db
			const fresh = createTestDatabase();
			db = fresh.db;
			cleanup = fresh.cleanup;
		});
	});
});
