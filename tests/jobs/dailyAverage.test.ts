import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Database } from "../../src/db";
import { createTestDatabase } from "../test-helpers";

describe("dailyAverage - DB統合テスト", () => {
	let db: Database;
	let cleanup: () => void;

	beforeEach(() => {
		({ db, cleanup } = createTestDatabase());
	});

	afterEach(() => {
		cleanup();
	});

	it("欠落日付の日次平均を計算・保存する", () => {
		db.insertPlayerData("2020-01-01 00:00:00", 100);
		db.insertPlayerData("2020-01-01 12:00:00", 200);
		db.insertPlayerData("2020-01-01 18:00:00", 300);

		const missingDates = db.getDatesWithDataButNoAverage();
		expect(missingDates).toContain("2020-01-01");

		for (const date of missingDates) {
			const result = db.calculateDailyAverage(date);
			if (result) db.upsertDailyAverage(result);
		}

		expect(db.getAllDailyAverages()).toHaveLength(1);
		expect(db.getDatesWithDataButNoAverage()).toEqual([]);
	});

	it("全日付に平均がある場合は何もしない", () => {
		db.insertPlayerData("2020-01-01 12:00:00", 100);
		const result = db.calculateDailyAverage("2020-01-01");
		if (result) db.upsertDailyAverage(result);

		expect(db.getDatesWithDataButNoAverage()).toEqual([]);
	});
});
