import { promises as fs } from "node:fs";
import { JWT } from "google-auth-library";
import type { sheets_v4 } from "googleapis";
import { google } from "googleapis";
import { googleServiceAccountSchema } from "../schemas/google-credentials";

/**
 * @description シートの列定義
 * @property headers - ヘッダー行の値
 * @property columnRange - 列の範囲(例: "A:B", "A:G")
 * @property toRow - レコードをスプレッドシートの行に変換
 * @property getKey - レコードのキー(upsert用の検索値)を返す
 */
export interface SheetColumnDef<T> {
	headers: string[];
	columnRange: string;
	toRow: (record: T) => unknown[];
	getKey: (record: T) => string;
}

/**
 * @description Google Sheetsアクセサの公開インターフェース
 */
export interface SheetAccessor<T> {
	append(record: T): Promise<void>;
	batchAppend(records: T[]): Promise<void>;
	replaceAll(records: T[]): Promise<void>;
}

/**
 * @description 認証済みのGoogle Sheets APIクライアントを生成
 * @param keyPath - サービスアカウントキーファイルパス
 * @returns Sheets APIクライアント
 */
async function createSheetsClient(keyPath: string): Promise<sheets_v4.Sheets> {
	const keyFile = await fs.readFile(keyPath, "utf8");
	const credentials = googleServiceAccountSchema.parse(JSON.parse(keyFile));

	const auth = new JWT({
		email: credentials.client_email,
		key: credentials.private_key,
		scopes: ["https://www.googleapis.com/auth/spreadsheets"],
	});

	return google.sheets({ version: "v4", auth });
}

/**
 * @description 汎用Google Sheetsアクセサを生成
 * @param spreadsheetId - スプレッドシートID
 * @param sheetName - シート名
 * @param keyPath - サービスアカウントキーファイルパス
 * @param columnDef - 列定義
 * @returns シート操作関数を持つオブジェクト
 */
export function createSheetAccessor<T>(
	spreadsheetId: string,
	sheetName: string,
	keyPath: string,
	columnDef: SheetColumnDef<T>,
): SheetAccessor<T> {
	let lastRequestTime = 0;
	const minRequestInterval = 100;
	let headerVerified = false;

	// 認証を遅延初期化(Promise をキャッシュして競合状態を防止)
	const sheetsPromise = createSheetsClient(keyPath);

	/**
	 * @description 認証済みクライアントを取得
	 */
	async function getSheets(): Promise<sheets_v4.Sheets> {
		return await sheetsPromise;
	}

	/**
	 * @description レート制限付きでAPIリクエストを実行(100ms間隔)
	 * @param requestFn - 実行するリクエスト関数
	 */
	async function rateLimitedRequest<R>(
		requestFn: () => Promise<R>,
	): Promise<R> {
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
		const sheets = await getSheets();
		try {
			await sheets.spreadsheets.batchUpdate({
				spreadsheetId,
				requestBody: {
					requests: [{ addSheet: { properties: { title: sheetName } } }],
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
	 * @description ヘッダー行を確保
	 */
	async function ensureHeader(): Promise<void> {
		if (headerVerified) return;
		const sheets = await getSheets();
		const { columnRange, headers } = columnDef;
		const lastCol = columnRange.split(":")[1];
		const headerRange = `${sheetName}!A1:${lastCol}1`;

		try {
			const response = await sheets.spreadsheets.values.get({
				spreadsheetId,
				range: headerRange,
			});

			const values = response.data.values;
			const firstCell = values?.[0]?.[0];
			if (!values || values.length === 0 || firstCell !== headers[0]) {
				await sheets.spreadsheets.values.update({
					spreadsheetId,
					range: headerRange,
					valueInputOption: "RAW",
					requestBody: { values: [headers] },
				});
			}
			headerVerified = true;
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("Unable to parse range")
			) {
				await createSheet();
				await ensureHeader();
			} else {
				throw error;
			}
		}
	}

	/**
	 * @description キーでレコード行を検索
	 * @param key - 検索するキー値
	 * @returns 行番号(1始まり)またはnull
	 */
	async function findRowByKey(key: string): Promise<number | null> {
		const sheets = await getSheets();
		try {
			const response = await sheets.spreadsheets.values.get({
				spreadsheetId,
				range: `${sheetName}!A:A`,
			});

			const values = response.data.values;
			if (!values || values.length <= 1) return null;

			for (let i = 1; i < values.length; i++) {
				if (values[i]?.[0] === key) return i + 1;
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
	 * @description シートデータをクリア(ヘッダー除く)
	 */
	async function clearData(): Promise<void> {
		const sheets = await getSheets();
		const { columnRange } = columnDef;
		try {
			const response = await rateLimitedRequest(() =>
				sheets.spreadsheets.values.get({
					spreadsheetId,
					range: `${sheetName}!${columnRange}`,
				}),
			);

			const rowCount = response.data.values?.length ?? 0;
			if (rowCount > 1) {
				const lastCol = columnRange.split(":")[1];
				await rateLimitedRequest(() =>
					sheets.spreadsheets.values.clear({
						spreadsheetId,
						range: `${sheetName}!A2:${lastCol}${rowCount}`,
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
	 * @description レコードを追加または更新
	 * @param record - 追加するレコード
	 */
	async function append(record: T): Promise<void> {
		const sheets = await getSheets();
		const { columnRange } = columnDef;
		try {
			await ensureHeader();

			const key = columnDef.getKey(record);
			const existingRow = await findRowByKey(key);
			const values = [columnDef.toRow(record)];
			const lastCol = columnRange.split(":")[1];

			if (existingRow !== null) {
				await rateLimitedRequest(() =>
					sheets.spreadsheets.values.update({
						spreadsheetId,
						range: `${sheetName}!A${existingRow}:${lastCol}${existingRow}`,
						valueInputOption: "RAW",
						requestBody: { values },
					}),
				);
			} else {
				await rateLimitedRequest(() =>
					sheets.spreadsheets.values.append({
						spreadsheetId,
						range: `${sheetName}!${columnRange}`,
						valueInputOption: "RAW",
						insertDataOption: "INSERT_ROWS",
						requestBody: { values },
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
	 * @description 複数レコードを一括追加
	 * @param records - 追加するレコードの配列
	 */
	async function batchAppend(records: T[]): Promise<void> {
		if (records.length === 0) return;

		const sheets = await getSheets();
		const { columnRange } = columnDef;
		try {
			await ensureHeader();

			const values = records.map((r) => columnDef.toRow(r));

			await rateLimitedRequest(() =>
				sheets.spreadsheets.values.append({
					spreadsheetId,
					range: `${sheetName}!${columnRange}`,
					valueInputOption: "RAW",
					insertDataOption: "INSERT_ROWS",
					requestBody: { values },
				}),
			);
		} catch (error) {
			throw new Error(
				`Failed to batch append records to Google Sheets: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * @description 全レコードを置換
	 * @param records - 置換するレコードの配列
	 */
	async function replaceAll(records: T[]): Promise<void> {
		const sheets = await getSheets();
		const { columnRange, headers } = columnDef;
		try {
			await clearData();

			if (records.length === 0) return;

			const sortedRecords = [...records].sort((a, b) =>
				columnDef.getKey(a).localeCompare(columnDef.getKey(b)),
			);

			const values = [headers, ...sortedRecords.map((r) => columnDef.toRow(r))];

			await rateLimitedRequest(() =>
				sheets.spreadsheets.values.update({
					spreadsheetId,
					range: `${sheetName}!${columnRange}`,
					valueInputOption: "RAW",
					requestBody: { values },
				}),
			);
		} catch (error) {
			throw new Error(
				`Failed to replace all records in Google Sheets: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	return { append, batchAppend, replaceAll };
}

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
