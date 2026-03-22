import { z } from "zod";

export const playerDataRowSchema = z.object({
	timestamp: z.string().min(1),
	playerCount: z.coerce.number().int(),
});

export type PlayerDataRow = z.infer<typeof playerDataRowSchema>;

export const dailyAverageRowSchema = z.object({
	date: z.string().min(1),
	averagePlayerCount: z.coerce.number().int(),
	sampleCount: z.coerce.number().int().nonnegative(),
	maxPlayerCount: z.coerce.number().int().optional(),
	maxPlayerTimestamp: z.string().optional(),
	minPlayerCount: z.coerce.number().int().optional(),
	minPlayerTimestamp: z.string().optional(),
});

export type DailyAverageRow = z.infer<typeof dailyAverageRowSchema>;
