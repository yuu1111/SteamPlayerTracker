import type { PlayerDataRecord } from "../types/config";
import { createLogger } from "../utils/logger";
import type {
	DailyAverageSheetRecord,
	GoogleSheetsService,
} from "./googleSheets";

interface QueuedRecord {
	type: "player" | "dailyAverage";
	data: PlayerDataRecord | DailyAverageSheetRecord;
	retryCount: number;
	timestamp: number;
}

export class QueuedGoogleSheetsService {
	private playerDataSheets: GoogleSheetsService | undefined;
	private dailyAverageSheets: GoogleSheetsService | undefined;
	private queue: QueuedRecord[] = [];
	private isProcessing: boolean = false;
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private logger: ReturnType<typeof createLogger>;
	private maxRetries: number = 3;
	private retryInterval: number = 30000;

	constructor(
		playerDataSheets?: GoogleSheetsService,
		dailyAverageSheets?: GoogleSheetsService,
		logger?: ReturnType<typeof createLogger>,
	) {
		this.playerDataSheets = playerDataSheets;
		this.dailyAverageSheets = dailyAverageSheets;
		this.logger = logger || createLogger("QueuedGoogleSheets");

		this.startQueueProcessor();
	}

	async addPlayerRecord(record: PlayerDataRecord): Promise<void> {
		if (!this.playerDataSheets) {
			throw new Error("Player data sheets service not initialized");
		}

		try {
			await this.playerDataSheets.appendRecord(record);
			this.logger.info(`Successfully wrote player record: ${record.timestamp}`);
		} catch (error) {
			this.logger.warn(
				`Failed to write player record immediately, queuing for retry: ${record.timestamp}`,
				{ error },
			);

			this.queue.push({
				type: "player",
				data: record,
				retryCount: 0,
				timestamp: Date.now(),
			});
		}
	}

	async addDailyAverageRecord(record: DailyAverageSheetRecord): Promise<void> {
		if (!this.dailyAverageSheets) {
			throw new Error("Daily average sheets service not initialized");
		}

		try {
			await this.dailyAverageSheets.appendDailyAverageRecord(record);
			this.logger.info(
				`Successfully wrote daily average record: ${record.timestamp}`,
			);
		} catch (error) {
			this.logger.warn(
				`Failed to write daily average record immediately, queuing for retry: ${record.timestamp}`,
				{ error },
			);

			this.queue.push({
				type: "dailyAverage",
				data: record,
				retryCount: 0,
				timestamp: Date.now(),
			});
		}
	}

	private startQueueProcessor(): void {
		this.intervalId = setInterval(async () => {
			if (this.isProcessing || this.queue.length === 0) {
				return;
			}

			this.isProcessing = true;
			await this.processQueue();
			this.isProcessing = false;
		}, this.retryInterval);
	}

	private async processQueue(): Promise<void> {
		if (this.queue.length === 0) {
			return;
		}

		this.logger.info(`Processing ${this.queue.length} queued records...`);
		const processed: number[] = [];

		for (let i = 0; i < this.queue.length; i++) {
			const queuedRecord = this.queue[i];
			if (!queuedRecord) continue;

			try {
				if (queuedRecord.type === "player") {
					await this.playerDataSheets?.appendRecord(
						queuedRecord.data as PlayerDataRecord,
					);
					this.logger.info(
						`Successfully processed queued player record: ${(queuedRecord.data as PlayerDataRecord).timestamp}`,
					);
				} else {
					await this.dailyAverageSheets?.appendDailyAverageRecord(
						queuedRecord.data as DailyAverageSheetRecord,
					);
					this.logger.info(
						`Successfully processed queued daily average record: ${(queuedRecord.data as DailyAverageSheetRecord).timestamp}`,
					);
				}

				processed.push(i);
			} catch (error) {
				queuedRecord.retryCount++;
				this.logger.warn(
					`Failed to process queued record (attempt ${queuedRecord.retryCount}/${this.maxRetries})`,
					{ error },
				);

				if (queuedRecord.retryCount >= this.maxRetries) {
					this.logger.error(
						`Max retries exceeded for record, removing from queue: ${JSON.stringify(queuedRecord.data)}`,
					);
					processed.push(i);
				}
			}
		}

		for (let i = processed.length - 1; i >= 0; i--) {
			const index = processed[i];
			if (index !== undefined) {
				this.queue.splice(index, 1);
			}
		}

		if (processed.length > 0) {
			this.logger.info(
				`Processed ${processed.length} records from queue. ${this.queue.length} records remaining.`,
			);
		}
	}

	dispose(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	getQueueStatus(): { queueLength: number; isProcessing: boolean } {
		return {
			queueLength: this.queue.length,
			isProcessing: this.isProcessing,
		};
	}

	async processQueueNow(): Promise<void> {
		if (this.isProcessing) {
			this.logger.info("Queue processing already in progress");
			return;
		}

		this.isProcessing = true;
		await this.processQueue();
		this.isProcessing = false;
	}
}
