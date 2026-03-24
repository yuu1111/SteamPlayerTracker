import { describe, expect, it, mock } from "bun:test";

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
		googleSheets: { enabled: false },
	},
}));

const { fullSyncToSheets, syncUnsyncedToSheets } = await import(
	"../../src/jobs/syncSheets"
);

describe("syncSheets (Google Sheets無効)", () => {
	it("syncUnsyncedToSheetsが早期リターンする", async () => {
		await expect(syncUnsyncedToSheets()).resolves.toBeUndefined();
	});

	it("fullSyncToSheetsが早期リターンする", async () => {
		await expect(fullSyncToSheets()).resolves.toBeUndefined();
	});
});
