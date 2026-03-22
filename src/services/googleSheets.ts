import { promises as fs } from "node:fs";
import { JWT } from "google-auth-library";
import type { sheets_v4 } from "googleapis";
import { google } from "googleapis";
import { googleServiceAccountSchema } from "../schemas/google-credentials";
import type { PlayerDataRecord } from "../types/config";

/**
 * @description Google Sheets日次平均レコードの型
 * @property timestamp - 日付文字列
 * @property playerCount - 平均プレイヤー数
 * @property sampleCount - サンプル数
 * @property maxPlayerCount - 最大プレイヤー数 @optional
 * @property maxPlayerTimestamp - 最大プレイヤー数の時刻 @optional
 * @property minPlayerCount - 最小プレイヤー数 @optional
 * @property minPlayerTimestamp - 最小プレイヤー数の時刻 @optional
 */
export interface DailyAverageSheetRecord {
	timestamp: string;
	playerCount: number;
	sampleCount: number;
	maxPlayerCount?: number | undefined;
	maxPlayerTimestamp?: string | undefined;
	minPlayerCount?: number | undefined;
	minPlayerTimestamp?: string | undefined;
}

/**
 * @description Google Sheetsサービスの公開インターフェース
 */
export interface GoogleSheetsService {
	appendRecord(record: PlayerDataRecord): Promise<void>;
	appendDailyAverageRecord(record: DailyAverageSheetRecord): Promise<void>;
	batchAppendRecords(records: PlayerDataRecord[]): Promise<void>;
	batchAppendDailyAverageRecords(
		records: DailyAverageSheetRecord[],
	): Promise<void>;
	replaceAllRecords(records: PlayerDataRecord[]): Promise<void>;
	replaceAllDailyAverageRecords(
		records: DailyAverageSheetRecord[],
	): Promise<void>;
}

/**
 * @description Google Sheetsサービスを生成
 * @param spreadsheetId - スプレッドシートID
 * @param sheetName - シート名
 * @param serviceAccountKeyPath - サービスアカウントキーファイルパス
 * @returns Google Sheets操作関数を持つオブジェクト
 */
export function createGoogleSheetsService(
	spreadsheetId: string,
	sheetName: string,
	serviceAccountKeyPath: string,
): GoogleSheetsService {
	let sheets: sheets_v4.Sheets;
	let lastRequestTime = 0;
	const minRequestInterval = 100;
	let headerVerified = false;
	let dailyAverageHeaderVerified = false;

	/**
	 * @description Google Sheets API認証を初期化
	 * @param keyPath - サービスアカウントキーファイルパス
	 */
	async function initializeAuth(keyPath: string): Promise<void> {
		try {
			const keyFile = await fs.readFile(keyPath, "utf8");
			const credentials = googleServiceAccountSchema.parse(JSON.parse(keyFile));

			const auth = new JWT({
				email: credentials.client_email,
				key: credentials.private_key,
				scopes: ["https://www.googleapis.com/auth/spreadsheets"],
			});

			sheets = google.sheets({ version: "v4", auth });
		} catch (error) {
			throw new Error(
				`Failed to initialize Google Sheets authentication: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * @description レート制限付きでAPIリクエストを実行(100ms間隔)
	 * @param requestFn - 実行するリクエスト関数
	 */
	async function rateLimitedRequest<T>(
		requestFn: () => Promise<T>,
	): Promise<T> {
		const now = Date.now();
		const timeSinceLastRequest = now - lastRequestTime;

		if (timeSinceLastRequest < minRequestInterval) {
			const delay = minRequestInterval - timeSinceLastRequest;
			await new Promise((resolve) => setTimeout(resolve, delay));
		}

		lastRequestTime = Date.now();
		return await requestFn();
	}

	/**
	 * @description シートを新規作成
	 */
	async function createSheet(): Promise<void> {
		try {
			await sheets.spreadsheets.batchUpdate({
				spreadsheetId,
				requestBody: {
					requests: [
						{
							addSheet: {
								properties: {
									title: sheetName,
								},
							},
						},
					],
				},
			});
		} catch (error) {
			if (
				!(error instanceof Error && error.message.includes("already exists"))
			) {
				throw error;
			}
		}
	}

	/**
	 * @description プレイヤーデータのヘッダー行を確保
	 */
	async function ensureHeaderExists(): Promise<void> {
		if (headerVerified) return;
		try {
			const response = await sheets.spreadsheets.values.get({
				spreadsheetId,
				range: `${sheetName}!A1:B1`,
			});

			const values = response.data.values;
			const firstCell = values?.[0]?.[0];
			if (
				!values ||
				values.length === 0 ||
				(firstCell !== "timestamp" && firstCell !== "timestamp (UTC)")
			) {
				await sheets.spreadsheets.values.update({
					spreadsheetId,
					range: `${sheetName}!A1:B1`,
					valueInputOption: "RAW",
					requestBody: {
						values: [["timestamp (UTC)", "player_count"]],
					},
				});
			}
			headerVerified = true;
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("Unable to parse range")
			) {
				await createSheet();
				await ensureHeaderExists();
			} else {
				throw error;
			}
		}
	}

	/**
	 * @description 日次平均データのヘッダー行を確保
	 */
	async function ensureDailyAverageHeaderExists(): Promise<void> {
		if (dailyAverageHeaderVerified) return;
		try {
			const response = await sheets.spreadsheets.values.get({
				spreadsheetId,
				range: `${sheetName}!A1:G1`,
			});

			const values = response.data.values;
			const firstCell = values?.[0]?.[0];
			if (
				!values ||
				values.length === 0 ||
				(firstCell !== "date" && firstCell !== "date (UTC)")
			) {
				await sheets.spreadsheets.values.update({
					spreadsheetId,
					range: `${sheetName}!A1:G1`,
					valueInputOption: "RAW",
					requestBody: {
						values: [
							[
								"date (UTC)",
								"average_player_count",
								"sample_count",
								"max_player_count",
								"max_timestamp (UTC)",
								"min_player_count",
								"min_timestamp (UTC)",
							],
						],
					},
				});
			}
			dailyAverageHeaderVerified = true;
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("Unable to parse range")
			) {
				await createSheet();
				await ensureDailyAverageHeaderExists();
			} else {
				throw error;
			}
		}
	}

	/**
	 * @description タイムスタンプでレコード行を検索
	 * @param timestamp - 検索するタイムスタンプ
	 * @returns 行番号(1始まり)またはnull
	 */
	async function findRecordByTimestamp(
		timestamp: string,
	): Promise<number | null> {
		try {
			const response = await sheets.spreadsheets.values.get({
				spreadsheetId,
				range: `${sheetName}!A:A`,
			});

			const values = response.data.values;
			if (!values || values.length <= 1) {
				return null;
			}

			for (let i = 1; i < values.length; i++) {
				const row = values[i];
				if (row && row[0] === timestamp) {
					return i + 1;
				}
			}

			return null;
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("Unable to parse range")
			) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * @description 日付で日次平均レコード行を検索
	 * @param date - 検索する日付文字列
	 * @returns 行番号(1始まり)またはnull
	 */
	async function findDailyAverageRecordByDate(
		date: string,
	): Promise<number | null> {
		try {
			const response = await sheets.spreadsheets.values.get({
				spreadsheetId,
				range: `${sheetName}!A:A`,
			});

			const values = response.data.values;
			if (!values || values.length <= 1) {
				return null;
			}

			for (let i = 1; i < values.length; i++) {
				const row = values[i];
				if (row && row[0] === date) {
					return i + 1;
				}
			}

			return null;
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("Unable to parse range")
			) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * @description プレイヤーデータのシートデータをクリア(ヘッダー除く)
	 */
	async function clearSheetData(): Promise<void> {
		try {
			const response = await rateLimitedRequest(() =>
				sheets.spreadsheets.values.get({
					spreadsheetId,
					range: `${sheetName}!A:B`,
				}),
			);

			const rowCount = response.data.values?.length ?? 0;
			if (rowCount > 1) {
				await rateLimitedRequest(() =>
					sheets.spreadsheets.values.clear({
						spreadsheetId,
						range: `${sheetName}!A2:B${rowCount}`,
					}),
				);
			}
		} catch (error) {
			if (
				!(
					error instanceof Error &&
					error.message.includes("Unable to parse range")
				)
			) {
				throw error;
			}
		}
	}

	/**
	 * @description 日次平均データのシートデータをクリア(ヘッダー除く)
	 */
	async function clearDailyAverageSheetData(): Promise<void> {
		try {
			const response = await rateLimitedRequest(() =>
				sheets.spreadsheets.values.get({
					spreadsheetId,
					range: `${sheetName}!A:G`,
				}),
			);

			const rowCount = response.data.values?.length ?? 0;
			if (rowCount > 1) {
				await rateLimitedRequest(() =>
					sheets.spreadsheets.values.clear({
						spreadsheetId,
						range: `${sheetName}!A2:G${rowCount}`,
					}),
				);
			}
		} catch (error) {
			if (
				!(
					error instanceof Error &&
					error.message.includes("Unable to parse range")
				)
			) {
				throw error;
			}
		}
	}

	/**
	 * @description プレイヤーデータレコードを追加または更新
	 * @param record - プレイヤーデータレコード
	 */
	async function appendRecord(record: PlayerDataRecord): Promise<void> {
		try {
			await ensureHeaderExists();

			const existingRowIndex = await findRecordByTimestamp(record.timestamp);

			const values = [[record.timestamp, record.playerCount]];

			if (existingRowIndex !== null) {
				await rateLimitedRequest(() =>
					sheets.spreadsheets.values.update({
						spreadsheetId,
						range: `${sheetName}!A${existingRowIndex}:B${existingRowIndex}`,
						valueInputOption: "RAW",
						requestBody: {
							values,
						},
					}),
				);
			} else {
				await rateLimitedRequest(() =>
					sheets.spreadsheets.values.append({
						spreadsheetId,
						range: `${sheetName}!A:B`,
						valueInputOption: "RAW",
						insertDataOption: "INSERT_ROWS",
						requestBody: {
							values,
						},
					}),
				);
			}
		} catch (error) {
			throw new Error(
				`Failed to append/update record to Google Sheets: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * @description 日次平均レコードを追加または更新
	 * @param record - 日次平均レコード
	 */
	async function appendDailyAverageRecord(
		record: DailyAverageSheetRecord,
	): Promise<void> {
		try {
			await ensureDailyAverageHeaderExists();

			const existingRowIndex = await findDailyAverageRecordByDate(
				record.timestamp,
			);

			const values = [
				[
					record.timestamp,
					record.playerCount,
					record.sampleCount,
					record.maxPlayerCount ?? "",
					record.maxPlayerTimestamp ?? "",
					record.minPlayerCount ?? "",
					record.minPlayerTimestamp ?? "",
				],
			];

			if (existingRowIndex !== null) {
				await rateLimitedRequest(() =>
					sheets.spreadsheets.values.update({
						spreadsheetId,
						range: `${sheetName}!A${existingRowIndex}:G${existingRowIndex}`,
						valueInputOption: "RAW",
						requestBody: {
							values,
						},
					}),
				);
			} else {
				await rateLimitedRequest(() =>
					sheets.spreadsheets.values.append({
						spreadsheetId,
						range: `${sheetName}!A:G`,
						valueInputOption: "RAW",
						insertDataOption: "INSERT_ROWS",
						requestBody: {
							values,
						},
					}),
				);
			}
		} catch (error) {
			throw new Error(
				`Failed to append/update daily average record to Google Sheets: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * @description 複数のプレイヤーデータレコードを一括追加
	 * @param records - プレイヤーデータレコードの配列
	 */
	async function batchAppendRecords(
		records: PlayerDataRecord[],
	): Promise<void> {
		if (records.length === 0) return;

		try {
			await ensureHeaderExists();

			const values = records.map((record) => [
				record.timestamp,
				record.playerCount,
			]);

			await rateLimitedRequest(() =>
				sheets.spreadsheets.values.append({
					spreadsheetId,
					range: `${sheetName}!A:B`,
					valueInputOption: "RAW",
					insertDataOption: "INSERT_ROWS",
					requestBody: {
						values,
					},
				}),
			);
		} catch (error) {
			throw new Error(
				`Failed to batch append records to Google Sheets: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * @description 複数の日次平均レコードを一括追加
	 * @param records - 日次平均レコードの配列
	 */
	async function batchAppendDailyAverageRecords(
		records: DailyAverageSheetRecord[],
	): Promise<void> {
		if (records.length === 0) return;

		try {
			await ensureDailyAverageHeaderExists();

			const values = records.map((record) => [
				record.timestamp,
				record.playerCount,
				record.sampleCount,
				record.maxPlayerCount ?? "",
				record.maxPlayerTimestamp ?? "",
				record.minPlayerCount ?? "",
				record.minPlayerTimestamp ?? "",
			]);

			await rateLimitedRequest(() =>
				sheets.spreadsheets.values.append({
					spreadsheetId,
					range: `${sheetName}!A:G`,
					valueInputOption: "RAW",
					insertDataOption: "INSERT_ROWS",
					requestBody: {
						values,
					},
				}),
			);
		} catch (error) {
			throw new Error(
				`Failed to batch append daily average records to Google Sheets: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * @description 全プレイヤーデータレコードを置換
	 * @param records - プレイヤーデータレコードの配列
	 */
	async function replaceAllRecords(records: PlayerDataRecord[]): Promise<void> {
		try {
			await clearSheetData();

			if (records.length === 0) return;

			const sortedRecords = [...records].sort((a, b) =>
				a.timestamp.localeCompare(b.timestamp),
			);

			const values = [
				["timestamp (UTC)", "player_count"],
				...sortedRecords.map((record) => [
					record.timestamp,
					record.playerCount,
				]),
			];

			await rateLimitedRequest(() =>
				sheets.spreadsheets.values.update({
					spreadsheetId,
					range: `${sheetName}!A:B`,
					valueInputOption: "RAW",
					requestBody: {
						values,
					},
				}),
			);
		} catch (error) {
			throw new Error(
				`Failed to replace all records in Google Sheets: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * @description 全日次平均レコードを置換
	 * @param records - 日次平均レコードの配列
	 */
	async function replaceAllDailyAverageRecords(
		records: DailyAverageSheetRecord[],
	): Promise<void> {
		try {
			await clearDailyAverageSheetData();

			if (records.length === 0) return;

			const sortedRecords = [...records].sort((a, b) =>
				a.timestamp.localeCompare(b.timestamp),
			);

			const values = [
				[
					"date (UTC)",
					"average_player_count",
					"sample_count",
					"max_player_count",
					"max_timestamp (UTC)",
					"min_player_count",
					"min_timestamp (UTC)",
				],
				...sortedRecords.map((record) => [
					record.timestamp,
					record.playerCount,
					record.sampleCount,
					record.maxPlayerCount ?? "",
					record.maxPlayerTimestamp ?? "",
					record.minPlayerCount ?? "",
					record.minPlayerTimestamp ?? "",
				]),
			];

			await rateLimitedRequest(() =>
				sheets.spreadsheets.values.update({
					spreadsheetId,
					range: `${sheetName}!A:G`,
					valueInputOption: "RAW",
					requestBody: {
						values,
					},
				}),
			);
		} catch (error) {
			throw new Error(
				`Failed to replace all daily average records in Google Sheets: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	// 認証を即時開始(現状のコンストラクタと同じ振る舞い)
	initializeAuth(serviceAccountKeyPath);

	return {
		appendRecord,
		appendDailyAverageRecord,
		batchAppendRecords,
		batchAppendDailyAverageRecords,
		replaceAllRecords,
		replaceAllDailyAverageRecords,
	};
}
