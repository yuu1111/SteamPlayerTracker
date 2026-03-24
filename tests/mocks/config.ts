import { mock } from "bun:test";

/**
 * @description テスト用Config設定を生成
 * @param googleSheetsEnabled - Google Sheets有効/無効 @default true
 */
export function createTestConfig(googleSheetsEnabled = true) {
	return {
		steam: { appId: 730 },
		storage: { dbPath: ":memory:" },
		scheduling: {
			collectionMinutes: [0, 30],
			dailyAverageHour: 0,
			sheetsSyncMinutes: [5, 35],
		},
		logging: { level: "info" },
		googleSheets: googleSheetsEnabled
			? {
					enabled: true as const,
					spreadsheetId: "test-spreadsheet",
					sheetName: "PlayerData",
					dailyAverageSheetName: "DailyAverages",
					serviceAccountKeyPath: "/fake/key.json",
				}
			: { enabled: false as const },
	};
}

/**
 * @description configモジュールをモック
 * @param modulePath - モジュールパス
 * @param googleSheetsEnabled - Google Sheets有効/無効
 */
export function mockConfigModule(
	modulePath: string,
	googleSheetsEnabled = true,
) {
	const config = createTestConfig(googleSheetsEnabled);
	mock.module(modulePath, () => ({ config }));
	return config;
}
