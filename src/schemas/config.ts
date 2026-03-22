import { z } from "zod";

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

const googleSheetsEnabledSchema = z.object({
	enabled: z.literal(true),
	spreadsheetId: z.string().min(1, "GOOGLE_SHEETS_SPREADSHEET_ID is required"),
	sheetName: z.string().default("PlayerData"),
	dailyAverageSheetName: z.string().default("DailyAverages"),
	serviceAccountKeyPath: z
		.string()
		.min(1, "GOOGLE_SERVICE_ACCOUNT_KEY_PATH is required"),
	syncOnStartup: z.boolean().default(false),
});

const googleSheetsDisabledSchema = z.object({
	enabled: z.literal(false),
});

const googleSheetsSchema = z.discriminatedUnion("enabled", [
	googleSheetsEnabledSchema,
	googleSheetsDisabledSchema,
]);

export const configSchema = z.object({
	steam: z.object({
		appId: z.coerce.number().int().positive(),
	}),
	output: z.object({
		csvEnabled: z.boolean().default(true),
		csvFilePath: z.string().default("steam_concurrent_players.csv"),
		dailyAverageCsvEnabled: z.boolean().default(true),
		dailyAverageCsvFilePath: z.string().default("steam_daily_averages.csv"),
	}),
	scheduling: z.object({
		collectionMinutes: collectionMinutesSchema,
		dailyAverageHour: z.coerce.number().int().min(0).max(23).default(0),
	}),
	retry: z.object({
		maxRetries: z.coerce.number().int().min(0).default(3),
		baseDelay: z.coerce.number().int().positive().default(1000),
	}),
	logging: z.object({
		level: z.enum(["debug", "info", "warn", "error"]).default("info"),
		filePath: z.string().default("logs/steam-tracker.log"),
	}),
	googleSheets: googleSheetsSchema,
});

export type Config = z.infer<typeof configSchema>;
export type GoogleSheetsEnabledConfig = z.infer<
	typeof googleSheetsEnabledSchema
>;
export type GoogleSheetsDisabledConfig = z.infer<
	typeof googleSheetsDisabledSchema
>;
export type GoogleSheetsConfig = z.infer<typeof googleSheetsSchema>;

export function parseConfig(env: NodeJS.ProcessEnv): Config {
	const gsEnabled = env.GOOGLE_SHEETS_ENABLED === "true";

	return configSchema.parse({
		steam: {
			appId: env.STEAM_APP_ID,
		},
		output: {
			csvEnabled: env.CSV_OUTPUT_ENABLED !== "false",
			csvFilePath: env.CSV_FILE_PATH || undefined,
			dailyAverageCsvEnabled: env.DAILY_AVERAGE_CSV_ENABLED !== "false",
			dailyAverageCsvFilePath: env.DAILY_AVERAGE_CSV_FILE_PATH || undefined,
		},
		scheduling: {
			collectionMinutes: env.COLLECTION_MINUTES || undefined,
			dailyAverageHour: env.DAILY_AVERAGE_HOUR || undefined,
		},
		retry: {
			maxRetries: env.MAX_RETRIES || undefined,
			baseDelay: env.RETRY_BASE_DELAY || undefined,
		},
		logging: {
			level: env.LOG_LEVEL || undefined,
			filePath: env.LOG_FILE_PATH || undefined,
		},
		googleSheets: gsEnabled
			? {
					enabled: true,
					spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
					sheetName: env.GOOGLE_SHEETS_SHEET_NAME || undefined,
					dailyAverageSheetName:
						env.GOOGLE_SHEETS_DAILY_AVERAGE_SHEET_NAME || undefined,
					serviceAccountKeyPath: env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
					syncOnStartup: env.GOOGLE_SHEETS_SYNC_ON_STARTUP === "true",
				}
			: { enabled: false },
	});
}
