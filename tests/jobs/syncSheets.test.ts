import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Database } from "../../src/db";
import { sampleDailyAverageRow } from "../test-helpers";

// createDatabaseのオリジナルを保持 (モック前にimport)
const { createDatabase: realCreateDatabase } = await import("../../src/db");

const mockBatchAppend = mock(() => Promise.resolve());
const mockAppend = mock(() => Promise.resolve());
const mockReplaceAll = mock(() => Promise.resolve());

mock.module("../../src/googleSheets", () => ({
	createSheetAccessor: () => ({
		append: mockAppend,
		batchAppend: mockBatchAppend,
		replaceAll: mockReplaceAll,
	}),
}));

let sharedDb: Database;

mock.module("../../src/config", () => ({
	config: {
		steam: { appId: 730 },
		storage: { dbPath: ":memory:" },
		scheduling: {
			collectionMinutes: [0, 30],
			dailyAverageHour: 0,
			sheetsSyncMinutes: [5, 35],
		},
		logging: { level: "info" },
		googleSheets: {
			enabled: true,
			spreadsheetId: "test-spreadsheet",
			sheetName: "PlayerData",
			dailyAverageSheetName: "DailyAverages",
			serviceAccountKeyPath: "/fake/key.json",
		},
	},
}));

const {
	playerDataColumnDef,
	dailyAverageColumnDef,
	fullSyncToSheets,
	syncUnsyncedToSheets,
	createSheetAccessors,
} = await import("../../src/jobs/syncSheets");

const testAccessors = createSheetAccessors();

describe("playerDataColumnDef", () => {
	it("toRowがPlayerDataRowを正しく変換する", () => {
		const row = playerDataColumnDef.toRow({
			timestamp: "2024-01-01 12:00:00",
			playerCount: 5000,
		});
		expect(row).toEqual(["2024-01-01 12:00:00", 5000]);
	});

	it("getKeyがtimestampを返す", () => {
		expect(
			playerDataColumnDef.getKey({
				timestamp: "2024-01-01 12:00:00",
				playerCount: 5000,
			}),
		).toBe("2024-01-01 12:00:00");
	});

	it("headersが2列", () => {
		expect(playerDataColumnDef.headers).toHaveLength(2);
	});

	it("columnRangeがA:B", () => {
		expect(playerDataColumnDef.columnRange).toBe("A:B");
	});
});

describe("dailyAverageColumnDef", () => {
	const sampleRow = sampleDailyAverageRow("2024-01-01");

	it("toRowが7要素配列に変換する", () => {
		const row = dailyAverageColumnDef.toRow(sampleRow);
		expect(row).toHaveLength(7);
	});

	it("getKeyがdateを返す", () => {
		expect(dailyAverageColumnDef.getKey(sampleRow)).toBe("2024-01-01");
	});

	it("headersが7列", () => {
		expect(dailyAverageColumnDef.headers).toHaveLength(7);
	});

	it("columnRangeがA:G", () => {
		expect(dailyAverageColumnDef.columnRange).toBe("A:G");
	});
});

describe("syncUnsyncedToSheets", () => {
	beforeEach(() => {
		// closeされないDBを毎回新規作成
		sharedDb = realCreateDatabase(":memory:");

		mockBatchAppend.mockClear();
		mockAppend.mockClear();
		mockReplaceAll.mockClear();
	});

	it("未同期データなしでno-op", async () => {
		await syncUnsyncedToSheets(sharedDb, testAccessors);
		expect(mockBatchAppend).not.toHaveBeenCalled();
		expect(mockAppend).not.toHaveBeenCalled();
	});

	it("未同期プレイヤーデータがある場合にbatchAppendが呼ばれる", async () => {
		sharedDb.insertPlayerData("2024-06-01 12:00:00", 5000);

		await syncUnsyncedToSheets(sharedDb, testAccessors);
		expect(mockBatchAppend).toHaveBeenCalledTimes(1);
	});

	it("未同期日次平均がある場合にappend(upsert)が呼ばれる", async () => {
		sharedDb.upsertDailyAverage(sampleDailyAverageRow("2024-06-01"));

		await syncUnsyncedToSheets(sharedDb, testAccessors);
		expect(mockAppend).toHaveBeenCalled();
	});

	it("Sheets APIエラー時にcatchされてthrowしない", async () => {
		sharedDb.insertPlayerData("2024-06-02 12:00:00", 3000);
		mockBatchAppend.mockRejectedValueOnce(new Error("API error"));

		await expect(
			syncUnsyncedToSheets(sharedDb, testAccessors),
		).resolves.toBeUndefined();
	});
});

describe("fullSyncToSheets", () => {
	beforeEach(() => {
		sharedDb = realCreateDatabase(":memory:");

		mockReplaceAll.mockClear();
	});

	it("全データを同期する", async () => {
		sharedDb.insertPlayerData("2024-06-01 12:00:00", 5000);
		sharedDb.upsertDailyAverage(sampleDailyAverageRow("2024-06-01"));

		await expect(
			fullSyncToSheets(sharedDb, testAccessors),
		).resolves.toBeUndefined();
		expect(mockReplaceAll).toHaveBeenCalledTimes(2);
	});
});
