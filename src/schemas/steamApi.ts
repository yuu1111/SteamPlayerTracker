import { z } from "zod";

export const steamPlayerCountResponseSchema = z.object({
	response: z.object({
		player_count: z.number(),
	}),
});

export type SteamPlayerCountResponse = z.infer<
	typeof steamPlayerCountResponseSchema
>;

export const steamAppDetailsSchema = z.object({
	success: z.literal(true),
	data: z.object({
		name: z.string(),
	}),
});

export type SteamAppDetails = z.infer<typeof steamAppDetailsSchema>;
