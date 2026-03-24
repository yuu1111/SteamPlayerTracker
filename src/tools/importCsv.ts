import { config } from "../config";
import {
	createDatabase,
	type DailyAverageRow,
	type PlayerDataRow,
} from "../db";
import { createLogger } from "../logger";

const logger = createLogger("import-csv");

/**
 * @description CSVコンテンツからプレイヤーデータ行をパース
 * @param content - CSV文字列
 */
export function parsePlayerDataCsv(content: string): PlayerDataRow[] {
	const lines = content.trim().split("\n");
	const results: PlayerDataRow[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("timestamp")) continue;

		const parts = trimmed.split(",");
		const timestamp = parts[0]?.trim();
		const playerCount = Number.parseInt(parts[1]?.trim() ?? "", 10);

		if (timestamp && !Number.isNaN(playerCount)) {
			results.push({ timestamp, playerCount });
		}
	}
	return results;
}

/**
 * @description CSVコンテンツから日次平均行をパース
 * @param content - CSV文字列
 */
export function parseDailyAverageCsv(content: string): DailyAverageRow[] {
	const lines = content.trim().split("\n");
	const results: DailyAverageRow[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("date")) continue;

		const parts = trimmed.split(",");
		const date = parts[0]?.trim();
		const avg = Number.parseInt(parts[1]?.trim() ?? "", 10);
		const samples = Number.parseInt(parts[2]?.trim() ?? "", 10);

		if (!date || Number.isNaN(avg) || Number.isNaN(samples)) continue;

		// 7列形式 (拡張)
		if (parts.length >= 7) {
			const maxCount = Number.parseInt(parts[3]?.trim() ?? "", 10);
			const maxTs = parts[4]?.trim() ?? "";
			const minCount = Number.parseInt(parts[5]?.trim() ?? "", 10);
			const minTs = parts[6]?.trim() ?? "";

			if (
				!Number.isNaN(maxCount) &&
				maxTs &&
				!Number.isNaN(minCount) &&
				minTs
			) {
				results.push({
					date,
					averagePlayerCount: avg,
					sampleCount: samples,
					maxPlayerCount: maxCount,
					maxTimestamp: maxTs,
					minPlayerCount: minCount,
					minTimestamp: minTs,
				});
				continue;
			}
		}

		// 3列形式 (旧フォーマット) - min/maxはavgで埋める
		results.push({
			date,
			averagePlayerCount: avg,
			sampleCount: samples,
			maxPlayerCount: avg,
			maxTimestamp: `${date} 00:00:00`,
			minPlayerCount: avg,
			minTimestamp: `${date} 00:00:00`,
		});
	}
	return results;
}

/**
 * @description CSVファイルを読み込む (ENOENTは警告ログのみで継続)
 * @param path - ファイルパス
 * @returns ファイル内容 (ファイルが存在しない場合はnull)
 */
async function readCsvFile(path: string): Promise<string | null> {
	try {
		return await Bun.file(path).text();
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
			logger.warn(`CSV not found: ${path}`);
			return null;
		}
		throw error;
	}
}

/**
 * @description メイン処理
 */
async function main() {
	const args = process.argv.slice(2);
	const playerCsvPath = args[0] ?? "steam_concurrent_players.csv";
	const avgCsvPath = args[1] ?? "steam_daily_averages.csv";

	try {
		using db = createDatabase(config.storage.dbPath);

		const playerContent = await readCsvFile(playerCsvPath);
		if (playerContent) {
			const playerRecords = parsePlayerDataCsv(playerContent);
			logger.info(
				`Parsed ${playerRecords.length} player data records from ${playerCsvPath}`,
			);
			if (playerRecords.length > 0) {
				db.transaction(() => {
					for (const record of playerRecords) {
						db.insertPlayerData(record.timestamp, record.playerCount);
					}
				});
				logger.info(`Imported ${playerRecords.length} player data records`);
			}
		}

		const avgContent = await readCsvFile(avgCsvPath);
		if (avgContent) {
			const avgRecords = parseDailyAverageCsv(avgContent);
			logger.info(
				`Parsed ${avgRecords.length} daily average records from ${avgCsvPath}`,
			);
			if (avgRecords.length > 0) {
				db.transaction(() => {
					for (const record of avgRecords) {
						db.upsertDailyAverage(record);
					}
				});
				logger.info(`Imported ${avgRecords.length} daily average records`);
			}
		}

		console.log("CSV import completed successfully!");
		process.exit(0);
	} catch (error) {
		logger.error("Import failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		console.error("Import failed:", error);
		process.exit(1);
	}
}

main();
