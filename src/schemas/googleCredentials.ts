import { z } from "zod";

export const googleServiceAccountSchema = z.object({
	client_email: z.string().email(),
	private_key: z.string().min(1),
});

export type GoogleServiceAccount = z.infer<typeof googleServiceAccountSchema>;
