import { promises as fs } from "node:fs";
import type { DailyAverageRow, PlayerDataRow } from "../schemas/csv";
import { parsePlayerDataCsv } from "../utils/csv-parser";
import type { createLogger } from "../utils/logger";
import { createCsvWriter } from "./csvWriter";
import type { QueuedGoogleSheetsService } from "./queuedGoogleSheets";

/**
 * @description 日次平均サービスの公開インターフェース
 */
export interface DailyAverageService {
	calculateAndSaveDailyAverage(
		date: Date,
		preloadedData?: PlayerDataRow[],
	): Promise<void>;
	updateAllDailyAverages(): Promise<void>;
	checkAndCalculateMissingAverages(): Promise<void>;
}

/**
 * @description 日次平均計算サービスを生成
 * @param sourceCsvPath - ソースCSVファイルパス
 * @param dailyAverageCsvPath - 日次平均CSVファイルパス
 * @param logger - ロガー
 * @param queuedGoogleSheets - キュー付きGoogle Sheetsサービス
 * @returns 日次平均計算関数を持つオブジェクト
 */
export function createDailyAverageService(
	sourceCsvPath: string,
	dailyAverageCsvPath: string,
	logger: ReturnType<typeof createLogger>,
	queuedGoogleSheets?: QueuedGoogleSheetsService,
): DailyAverageService {
	const csvWriter = createCsvWriter(dailyAverageCsvPath);

	/**
	 * @description ソースCSVから全レコードを読み込み
	 * @returns プレイヤーデータレコードの配列
	 */
	async function readAllRecords(): Promise<PlayerDataRow[]> {
		try {
			const csvContent = await fs.readFile(sourceCsvPath, "utf8");
			return parsePlayerDataCsv(csvContent);
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
				return [];
			}
			throw error;
		}
	}

	/**
	 * @description レコードを日付ごとにグループ化
	 * @param records - プレイヤーデータレコードの配列
	 * @returns 日付をキーとするレコードのMap
	 */
	function groupByDate(records: PlayerDataRow[]): Map<string, PlayerDataRow[]> {
		const groups = new Map<string, PlayerDataRow[]>();
		for (const record of records) {
			const date = record.timestamp.split(" ")[0];
			if (!date) continue;
			const group = groups.get(date);
			if (group) {
				group.push(record);
			} else {
				groups.set(date, [record]);
			}
		}
		return groups;
	}

	/**
	 * @description 指定日のレコードを読み込み
	 * @param dateStr - 日付文字列
	 * @returns 該当日のプレイヤーデータレコード
	 */
	async function readDailyData(dateStr: string): Promise<PlayerDataRow[]> {
		const allRecords = await readAllRecords();
		return allRecords.filter((r) => r.timestamp.startsWith(dateStr));
	}

	/**
	 * @description 平均レコードをCSVとGoogle Sheetsに保存
	 * @param record - 日次平均レコード
	 */
	async function saveAverageRecord(record: DailyAverageRow): Promise<void> {
		const savePromises: Promise<void>[] = [];

		savePromises.push(
			csvWriter.writeDailyAverageRecord(
				record.date,
				record.averagePlayerCount,
				record.sampleCount,
				record.maxPlayerCount,
				record.maxPlayerTimestamp,
				record.minPlayerCount,
				record.minPlayerTimestamp,
			),
		);

		if (queuedGoogleSheets) {
			savePromises.push(queuedGoogleSheets.addDailyAverageRecord(record));
		}

		await Promise.all(savePromises);
	}

	/**
	 * @description 指定日の日次平均を計算して保存
	 * @param date - 対象日
	 * @param preloadedData - 事前読み込み済みデータ
	 */
	async function calculateAndSaveDailyAverage(
		date: Date,
		preloadedData?: PlayerDataRow[],
	): Promise<void> {
		try {
			const dateStr = date.toISOString().split("T")[0] ?? "";
			logger.info(`Calculating daily average for ${dateStr}`);

			const dailyData = preloadedData ?? (await readDailyData(dateStr));

			if (dailyData.length === 0) {
				logger.warn(`No data found for ${dateStr}`);
				return;
			}

			const validData = dailyData.filter((record) => record.playerCount > 0);

			if (validData.length === 0) {
				logger.warn(`No valid data (non-zero) found for ${dateStr}`);
				return;
			}

			const sum = validData.reduce(
				(acc, record) => acc + record.playerCount,
				0,
			);
			const average = Math.round(sum / validData.length);

			let maxRecord = validData[0];
			let minRecord = validData[0];

			if (!maxRecord || !minRecord) {
				logger.warn(`No valid records found for ${dateStr}`);
				return;
			}

			for (const record of validData) {
				if (record.playerCount > maxRecord.playerCount) {
					maxRecord = record;
				}
				if (record.playerCount < minRecord.playerCount) {
					minRecord = record;
				}
			}

			const averageRecord: DailyAverageRow = {
				date: dateStr,
				averagePlayerCount: average,
				sampleCount: validData.length,
				maxPlayerCount: maxRecord.playerCount,
				maxPlayerTimestamp: maxRecord.timestamp,
				minPlayerCount: minRecord.playerCount,
				minPlayerTimestamp: minRecord.timestamp,
			};

			await saveAverageRecord(averageRecord);

			logger.info(`Daily average calculated successfully for ${dateStr}`, {
				average,
				sampleCount: validData.length,
				excludedZeros: dailyData.length - validData.length,
				max: averageRecord.maxPlayerCount,
				maxTime: averageRecord.maxPlayerTimestamp,
				min: averageRecord.minPlayerCount,
				minTime: averageRecord.minPlayerTimestamp,
			});
		} catch (error) {
			logger.error(
				`Failed to calculate daily average: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			throw error;
		}
	}

	/**
	 * @description 全日次平均を再計算
	 */
	async function updateAllDailyAverages(): Promise<void> {
		try {
			logger.info("Updating all daily averages...");

			const allRecords = await readAllRecords();

			if (allRecords.length === 0) {
				logger.warn("No data to process");
				return;
			}

			const grouped = groupByDate(allRecords);

			for (const [dateStr, records] of grouped) {
				const date = new Date(dateStr);
				await calculateAndSaveDailyAverage(date, records);
			}

			logger.info(`Updated daily averages for ${grouped.size} days`);
		} catch (error) {
			logger.error(
				`Failed to update all daily averages: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			throw error;
		}
	}

	/**
	 * @description 欠落している日次平均を検出して計算
	 */
	async function checkAndCalculateMissingAverages(): Promise<void> {
		try {
			logger.info("Checking for missing daily averages...");

			const allRecords = await readAllRecords();

			if (allRecords.length === 0) {
				logger.info("No source data to process");
				return;
			}

			const grouped = groupByDate(allRecords);
			const today = new Date().toISOString().split("T")[0] ?? "";

			const existingAverages = new Set<string>();
			try {
				const averageContent = await fs.readFile(dailyAverageCsvPath, "utf8");
				const avgRecords = parsePlayerDataCsv(averageContent);
				for (const record of avgRecords) {
					existingAverages.add(record.timestamp.trim());
				}
			} catch (error) {
				if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
					throw error;
				}
			}

			const missingDates = Array.from(grouped.keys())
				.filter((date) => date < today && !existingAverages.has(date))
				.sort();

			if (missingDates.length === 0) {
				logger.info("All daily averages are up to date");
				return;
			}

			logger.info(`Found ${missingDates.length} missing daily averages`);

			for (const dateStr of missingDates) {
				const date = new Date(dateStr);
				await calculateAndSaveDailyAverage(date, grouped.get(dateStr));
			}

			logger.info(`Calculated ${missingDates.length} missing daily averages`);
		} catch (error) {
			logger.error(
				`Failed to check missing averages: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			throw error;
		}
	}

	return {
		calculateAndSaveDailyAverage,
		updateAllDailyAverages,
		checkAndCalculateMissingAverages,
	};
}
