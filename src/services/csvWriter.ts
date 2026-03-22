import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import type { PlayerDataRow } from "../schemas/csv";

/**
 * @description CSVライターを生成
 * @param filePath - 出力先CSVファイルパス
 * @returns CSV書き込み関数を持つオブジェクト
 */
export function createCsvWriter(filePath: string) {
	/**
	 * @description ファイルの存在を確認
	 * @returns ファイルが存在するかどうか
	 */
	async function fileExists(): Promise<boolean> {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * @description 出力先ディレクトリを確保
	 */
	async function ensureDirectoryExists(): Promise<void> {
		const dir = dirname(filePath);
		await fs.mkdir(dir, { recursive: true });
	}

	/**
	 * @description プレイヤーデータレコードをCSVに書き込み
	 * @param record - プレイヤーデータレコード
	 */
	async function writeRecord(record: PlayerDataRow): Promise<void> {
		try {
			await ensureDirectoryExists();

			const exists = await fileExists();
			const csvLine = `${record.timestamp},${record.playerCount}\n`;

			if (!exists) {
				const header = "timestamp,player_count\n";
				await fs.writeFile(filePath, header + csvLine, "utf8");
			} else {
				await fs.appendFile(filePath, csvLine, "utf8");
			}
		} catch (error) {
			throw new Error(
				`Failed to write CSV record: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * @description 日次平均レコードをCSVに書き込み
	 * @param date - 日付文字列
	 * @param averagePlayerCount - 平均プレイヤー数
	 * @param sampleCount - サンプル数
	 * @param maxPlayerCount - 最大プレイヤー数
	 * @param maxPlayerTimestamp - 最大プレイヤー数の時刻
	 * @param minPlayerCount - 最小プレイヤー数
	 * @param minPlayerTimestamp - 最小プレイヤー数の時刻
	 */
	async function writeDailyAverageRecord(
		date: string,
		averagePlayerCount: number,
		sampleCount: number,
		maxPlayerCount?: number,
		maxPlayerTimestamp?: string,
		minPlayerCount?: number,
		minPlayerTimestamp?: string,
	): Promise<void> {
		try {
			await ensureDirectoryExists();

			const exists = await fileExists();

			let csvLine: string;
			if (
				maxPlayerCount !== undefined &&
				maxPlayerTimestamp &&
				minPlayerCount !== undefined &&
				minPlayerTimestamp
			) {
				csvLine = `${date},${averagePlayerCount},${sampleCount},${maxPlayerCount},${maxPlayerTimestamp},${minPlayerCount},${minPlayerTimestamp}\n`;
			} else {
				csvLine = `${date},${averagePlayerCount},${sampleCount}\n`;
			}

			if (!exists) {
				const header =
					maxPlayerCount !== undefined
						? "date,average_player_count,sample_count,max_player_count,max_timestamp,min_player_count,min_timestamp\n"
						: "date,average_player_count,sample_count\n";
				await fs.writeFile(filePath, header + csvLine, "utf8");
			} else {
				await fs.appendFile(filePath, csvLine, "utf8");
			}
		} catch (error) {
			throw new Error(
				`Failed to write daily average CSV record: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	return { writeRecord, writeDailyAverageRecord };
}

/**
 * @description createCsvWriterの返り値の型
 */
export type CsvWriter = ReturnType<typeof createCsvWriter>;
