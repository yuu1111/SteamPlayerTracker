import {
	type DailyAverageRow,
	dailyAverageRowSchema,
	type PlayerDataRow,
	playerDataRowSchema,
} from "../schemas/csv";

export function parsePlayerDataCsv(content: string): PlayerDataRow[] {
	const lines = content.trim().split("\n");
	if (lines.length <= 1) return [];

	const records: PlayerDataRow[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;

		const parts = line.split(",");
		const result = playerDataRowSchema.safeParse({
			timestamp: parts[0]?.trim(),
			playerCount: parts[1]?.trim(),
		});

		if (result.success) {
			records.push(result.data);
		}
	}

	return records;
}

export function parseDailyAverageCsv(content: string): DailyAverageRow[] {
	const lines = content.trim().split("\n");
	if (lines.length <= 1) return [];

	const headerLine = lines[0];
	const header = headerLine ? headerLine.split(",") : [];
	const hasExtendedData = header.length > 3;

	const records: DailyAverageRow[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;

		const parts = line.split(",");
		if (parts.length < 3) continue;

		const raw: Record<string, unknown> = {
			date: parts[0]?.trim(),
			averagePlayerCount: parts[1]?.trim(),
			sampleCount: parts[2]?.trim(),
		};

		if (hasExtendedData) {
			if (parts[3]) raw.maxPlayerCount = parts[3].trim();
			if (parts[4]) raw.maxPlayerTimestamp = parts[4].trim();
			if (parts[5]) raw.minPlayerCount = parts[5].trim();
			if (parts[6]) raw.minPlayerTimestamp = parts[6].trim();
		}

		const result = dailyAverageRowSchema.safeParse(raw);
		if (result.success) {
			records.push(result.data);
		}
	}

	return records;
}
