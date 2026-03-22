import type { DailyAverageRow, PlayerDataRow } from "../schemas/csv";
import { createLogger } from "../utils/logger";
import type { SheetAccessor } from "./googleSheets";

/**
 * @description キュー内のレコード
 * @property type - レコード種別
 * @property data - レコードデータ
 * @property retryCount - リトライ回数
 * @property timestamp - キューイング時刻
 */
interface QueuedRecord {
	type: "player" | "dailyAverage";
	data: PlayerDataRow | DailyAverageRow;
	retryCount: number;
	timestamp: number;
}

/**
 * @description キュー付きGoogle Sheetsサービスの公開インターフェース
 */
export interface QueuedGoogleSheetsService {
	addPlayerRecord(record: PlayerDataRow): Promise<void>;
	addDailyAverageRecord(record: DailyAverageRow): Promise<void>;
	dispose(): void;
	getQueueStatus(): { queueLength: number; isProcessing: boolean };
	processQueueNow(): Promise<void>;
}

/**
 * @description リトライキュー付きGoogle Sheetsサービスを生成
 * @param playerDataSheets - プレイヤーデータ用Sheetsアクセサ
 * @param dailyAverageSheets - 日次平均用Sheetsアクセサ
 * @param logger - ロガー
 * @returns キュー管理関数を持つオブジェクト
 */
export function createQueuedGoogleSheetsService(
	playerDataSheets?: SheetAccessor<PlayerDataRow>,
	dailyAverageSheets?: SheetAccessor<DailyAverageRow>,
	logger?: ReturnType<typeof createLogger>,
): QueuedGoogleSheetsService {
	const log = logger || createLogger("QueuedGoogleSheets");
	const maxRetries = 3;
	const retryInterval = 30000;
	const queue: QueuedRecord[] = [];
	let isProcessing = false;
	let intervalId: ReturnType<typeof setInterval> | null = null;

	/**
	 * @description キュー内のレコードを処理
	 */
	async function processQueue(): Promise<void> {
		if (queue.length === 0) return;

		log.info(`Processing ${queue.length} queued records...`);
		const processed: number[] = [];

		for (let i = 0; i < queue.length; i++) {
			const queuedRecord = queue[i];
			if (!queuedRecord) continue;

			try {
				if (queuedRecord.type === "player") {
					await playerDataSheets?.append(queuedRecord.data as PlayerDataRow);
					log.info(
						`Successfully processed queued player record: ${(queuedRecord.data as PlayerDataRow).timestamp}`,
					);
				} else {
					await dailyAverageSheets?.append(
						queuedRecord.data as DailyAverageRow,
					);
					log.info(
						`Successfully processed queued daily average record: ${(queuedRecord.data as DailyAverageRow).date}`,
					);
				}

				processed.push(i);
			} catch (error) {
				queuedRecord.retryCount++;
				log.warn(
					`Failed to process queued record (attempt ${queuedRecord.retryCount}/${maxRetries})`,
					{ error },
				);

				if (queuedRecord.retryCount >= maxRetries) {
					log.error(
						`Max retries exceeded for record, removing from queue: ${JSON.stringify(queuedRecord.data)}`,
					);
					processed.push(i);
				}
			}
		}

		for (let i = processed.length - 1; i >= 0; i--) {
			const index = processed[i];
			if (index !== undefined) {
				queue.splice(index, 1);
			}
		}

		if (processed.length > 0) {
			log.info(
				`Processed ${processed.length} records from queue. ${queue.length} records remaining.`,
			);
		}
	}

	/**
	 * @description キュー処理のインターバルを開始
	 */
	function startQueueProcessor(): void {
		intervalId = setInterval(async () => {
			if (isProcessing || queue.length === 0) return;

			isProcessing = true;
			await processQueue();
			isProcessing = false;
		}, retryInterval);
	}

	/**
	 * @description プレイヤーデータレコードを追加(失敗時はキューイング)
	 * @param record - プレイヤーデータレコード
	 */
	async function addPlayerRecord(record: PlayerDataRow): Promise<void> {
		if (!playerDataSheets) {
			throw new Error("Player data sheets service not initialized");
		}

		try {
			await playerDataSheets.append(record);
			log.info(`Successfully wrote player record: ${record.timestamp}`);
		} catch (error) {
			log.warn(
				`Failed to write player record immediately, queuing for retry: ${record.timestamp}`,
				{ error },
			);

			queue.push({
				type: "player",
				data: record,
				retryCount: 0,
				timestamp: Date.now(),
			});
		}
	}

	/**
	 * @description 日次平均レコードを追加(失敗時はキューイング)
	 * @param record - 日次平均レコード
	 */
	async function addDailyAverageRecord(record: DailyAverageRow): Promise<void> {
		if (!dailyAverageSheets) {
			throw new Error("Daily average sheets service not initialized");
		}

		try {
			await dailyAverageSheets.append(record);
			log.info(`Successfully wrote daily average record: ${record.date}`);
		} catch (error) {
			log.warn(
				`Failed to write daily average record immediately, queuing for retry: ${record.date}`,
				{ error },
			);

			queue.push({
				type: "dailyAverage",
				data: record,
				retryCount: 0,
				timestamp: Date.now(),
			});
		}
	}

	/**
	 * @description インターバルを停止してリソースを解放
	 */
	function dispose(): void {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	/**
	 * @description キューの状態を取得
	 * @returns キュー長と処理中フラグ
	 */
	function getQueueStatus(): { queueLength: number; isProcessing: boolean } {
		return { queueLength: queue.length, isProcessing };
	}

	/**
	 * @description キューを即座に処理
	 */
	async function processQueueNow(): Promise<void> {
		if (isProcessing) {
			log.info("Queue processing already in progress");
			return;
		}

		isProcessing = true;
		await processQueue();
		isProcessing = false;
	}

	startQueueProcessor();

	return {
		addPlayerRecord,
		addDailyAverageRecord,
		dispose,
		getQueueStatus,
		processQueueNow,
	};
}
