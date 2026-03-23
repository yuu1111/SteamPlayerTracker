import { z } from "zod";

/**
 * @description コレクション分のカンマ区切り文字列を数値配列に変換
 */
const collectionMinutesSchema = z
	.string()
	.default("0,30")
	.transform((val) => {
		const minutes = val
			.split(",")
			.map((m) => Number.parseInt(m.trim(), 10))
			.filter((m) => !Number.isNaN(m) && m >= 0 && m < 60);
		if (minutes.length === 0) {
			throw new Error("At least one valid minute (0-59) is required");
		}
		return minutes;
	});

/**
 * @description Google Sheets有効時の設定スキーマ
 */
const googleSheetsEnabledSchema = z.object({
	enabled: z.literal(true),
	spreadsheetId: z.string().min(1, "GOOGLE_SHEETS_SPREADSHEET_ID is required"),
	sheetName: z.string().default("PlayerData"),
	dailyAverageSheetName: z.string().default("DailyAverages"),
	serviceAccountKeyPath: z
		.string()
		.min(1, "GOOGLE_SERVICE_ACCOUNT_KEY_PATH is required"),
});

/**
 * @description Google Sheets無効時の設定スキーマ
 */
const googleSheetsDisabledSchema = z.object({
	enabled: z.literal(false),
});

/**
 * @description Google Sheets設定の判別共用体
 */
const googleSheetsSchema = z.discriminatedUnion("enabled", [
	googleSheetsEnabledSchema,
	googleSheetsDisabledSchema,
]);

/**
 * @description アプリケーション設定のZodスキーマ
 */
export const configSchema = z.object({
	steam: z.object({
		appId: z.coerce.number().int().positive(),
	}),
	storage: z.object({
		dbPath: z.string().default("data/steam-tracker.db"),
	}),
	scheduling: z.object({
		collectionMinutes: collectionMinutesSchema,
		dailyAverageHour: z.coerce.number().int().min(0).max(23).default(0),
		sheetsSyncMinutes: collectionMinutesSchema,
	}),
	retry: z.object({
		maxRetries: z.coerce.number().int().min(0).default(3),
		baseDelay: z.coerce.number().int().positive().default(1000),
	}),
	logging: z.object({
		level: z.enum(["debug", "info", "warn", "error"]).default("info"),
	}),
	googleSheets: googleSheetsSchema,
});

/**
 * @description パース済み設定の型
 */
export type Config = z.infer<typeof configSchema>;

/**
 * @description Google Sheets有効時の設定型
 */
export type GoogleSheetsEnabledConfig = z.infer<
	typeof googleSheetsEnabledSchema
>;

/**
 * @description Google Sheets設定の共用体型
 */
export type GoogleSheetsConfig = z.infer<typeof googleSheetsSchema>;

/**
 * @description 環境変数をパースして設定オブジェクトを生成
 * @param env - 環境変数オブジェクト
 * @returns パース済み設定
 */
export function parseConfig(env: NodeJS.ProcessEnv): Config {
	const gsEnabled = env.GOOGLE_SHEETS_ENABLED === "true";

	return configSchema.parse({
		steam: {
			appId: env.STEAM_APP_ID,
		},
		storage: {
			dbPath: env.DB_PATH || undefined,
		},
		scheduling: {
			collectionMinutes: env.COLLECTION_MINUTES || undefined,
			dailyAverageHour: env.DAILY_AVERAGE_HOUR || undefined,
			sheetsSyncMinutes: env.SHEETS_SYNC_MINUTES || undefined,
		},
		retry: {
			maxRetries: env.MAX_RETRIES || undefined,
			baseDelay: env.RETRY_BASE_DELAY || undefined,
		},
		logging: {
			level: env.LOG_LEVEL || undefined,
		},
		googleSheets: gsEnabled
			? {
					enabled: true,
					spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
					sheetName: env.GOOGLE_SHEETS_SHEET_NAME || undefined,
					dailyAverageSheetName:
						env.GOOGLE_SHEETS_DAILY_AVERAGE_SHEET_NAME || undefined,
					serviceAccountKeyPath: env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
				}
			: { enabled: false },
	});
}

/**
 * @description 環境変数からパース済みのアプリケーション設定
 */
export const config = parseConfig(process.env);
