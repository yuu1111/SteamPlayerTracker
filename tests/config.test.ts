import { describe, expect, it } from "bun:test";
import { parseConfig } from "../src/config";

/**
 * @description 最小構成の環境変数
 */
function minimalEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
	return { STEAM_APP_ID: "730", ...overrides };
}

describe("parseConfig", () => {
	it("最小構成でデフォルト値が適用される", () => {
		const config = parseConfig(minimalEnv());
		expect(config.steam.appId).toBe(730);
		expect(config.storage.dbPath).toBe("data/steam-tracker.db");
		expect(config.scheduling.collectionMinutes).toEqual([0, 30]);
		expect(config.scheduling.dailyAverageHour).toBe(0);
		expect(config.logging.level).toBe("info");
		expect(config.googleSheets.enabled).toBe(false);
	});

	it("STEAM_APP_IDを数値に変換する", () => {
		const config = parseConfig(minimalEnv());
		expect(typeof config.steam.appId).toBe("number");
	});

	it("STEAM_APP_ID欠落でエラー", () => {
		expect(() => parseConfig({})).toThrow();
	});

	it("STEAM_APP_IDが負値でエラー", () => {
		expect(() => parseConfig({ STEAM_APP_ID: "-1" })).toThrow();
	});

	it("STEAM_APP_IDが非数値でエラー", () => {
		expect(() => parseConfig({ STEAM_APP_ID: "abc" })).toThrow();
	});

	it("カスタムDB_PATHを適用する", () => {
		const config = parseConfig(minimalEnv({ DB_PATH: "/custom/path.db" }));
		expect(config.storage.dbPath).toBe("/custom/path.db");
	});

	it("カスタムCOLLECTION_MINUTESをパースする", () => {
		const config = parseConfig(
			minimalEnv({ COLLECTION_MINUTES: "0,15,30,45" }),
		);
		expect(config.scheduling.collectionMinutes).toEqual([0, 15, 30, 45]);
	});

	it("COLLECTION_MINUTESの無効値をフィルタする", () => {
		const config = parseConfig(
			minimalEnv({ COLLECTION_MINUTES: "0,abc,60,-1,30" }),
		);
		expect(config.scheduling.collectionMinutes).toEqual([0, 30]);
	});

	it("COLLECTION_MINUTESが全て無効でエラー", () => {
		expect(() =>
			parseConfig(minimalEnv({ COLLECTION_MINUTES: "abc,def" })),
		).toThrow();
	});

	it("LOG_LEVELをパースする", () => {
		const config = parseConfig(minimalEnv({ LOG_LEVEL: "debug" }));
		expect(config.logging.level).toBe("debug");
	});

	it("Google Sheets有効時の設定をパースする", () => {
		const config = parseConfig(
			minimalEnv({
				GOOGLE_SHEETS_ENABLED: "true",
				GOOGLE_SHEETS_SPREADSHEET_ID: "abc123",
				GOOGLE_SERVICE_ACCOUNT_KEY_PATH: "/path/key.json",
			}),
		);
		expect(config.googleSheets.enabled).toBe(true);
		if (config.googleSheets.enabled) {
			expect(config.googleSheets.spreadsheetId).toBe("abc123");
			expect(config.googleSheets.sheetName).toBe("PlayerData");
			expect(config.googleSheets.dailyAverageSheetName).toBe("DailyAverages");
		}
	});

	it("Google Sheets有効でspreadsheetId欠落でエラー", () => {
		expect(() =>
			parseConfig(
				minimalEnv({
					GOOGLE_SHEETS_ENABLED: "true",
					GOOGLE_SERVICE_ACCOUNT_KEY_PATH: "/path",
				}),
			),
		).toThrow();
	});

	it("Google Sheets有効でserviceAccountKeyPath欠落でエラー", () => {
		expect(() =>
			parseConfig(
				minimalEnv({
					GOOGLE_SHEETS_ENABLED: "true",
					GOOGLE_SHEETS_SPREADSHEET_ID: "abc",
				}),
			),
		).toThrow();
	});

	it("DAILY_AVERAGE_HOURをパースする", () => {
		const config = parseConfig(minimalEnv({ DAILY_AVERAGE_HOUR: "12" }));
		expect(config.scheduling.dailyAverageHour).toBe(12);
	});

	it("DAILY_AVERAGE_HOURが範囲外でエラー", () => {
		expect(() =>
			parseConfig(minimalEnv({ DAILY_AVERAGE_HOUR: "24" })),
		).toThrow();
	});
});
