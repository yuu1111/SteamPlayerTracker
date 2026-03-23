import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config";
import { createDatabase } from "../db";
import { createLogger } from "../logger";

const logger = createLogger("export-csv");

/**
 * @description メイン処理
 */
async function main() {
	const args = process.argv.slice(2);
	const playerCsvPath = args[0] ?? "steam_concurrent_players.csv";
	const avgCsvPath = args[1] ?? "steam_daily_averages.csv";

	try {
		const db = createDatabase(config.storage.dbPath);

		// プレイヤーデータのエクスポート
		const players = db.getAllPlayerData();
		if (players.length > 0) {
			const header = "timestamp,player_count\n";
			const rows = players
				.map((r) => `${r.timestamp},${r.playerCount}`)
				.join("\n");
			await fs.mkdir(dirname(playerCsvPath), { recursive: true });
			await fs.writeFile(playerCsvPath, `${header + rows}\n`, "utf8");
			logger.info(
				`Exported ${players.length} player records to ${playerCsvPath}`,
			);
		} else {
			logger.warn("No player data to export");
		}

		// 日次平均のエクスポート
		const averages = db.getAllDailyAverages();
		if (averages.length > 0) {
			const header =
				"date,average_player_count,sample_count,max_player_count,max_timestamp,min_player_count,min_timestamp\n";
			const rows = averages
				.map(
					(r) =>
						`${r.date},${r.averagePlayerCount},${r.sampleCount},${r.maxPlayerCount},${r.maxTimestamp},${r.minPlayerCount},${r.minTimestamp}`,
				)
				.join("\n");
			await fs.mkdir(dirname(avgCsvPath), { recursive: true });
			await fs.writeFile(avgCsvPath, `${header + rows}\n`, "utf8");
			logger.info(
				`Exported ${averages.length} daily average records to ${avgCsvPath}`,
			);
		} else {
			logger.warn("No daily average data to export");
		}

		db.close();
		console.log("CSV export completed successfully!");
		process.exit(0);
	} catch (error) {
		logger.error("Export failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		console.error("Export failed:", error);
		process.exit(1);
	}
}

main();
