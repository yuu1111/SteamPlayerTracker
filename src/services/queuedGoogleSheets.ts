import { GoogleSheetsService, DailyAverageSheetRecord } from './googleSheets';
import { PlayerDataRecord } from '../types/config';
import { Logger } from '../utils/logger';

interface QueuedRecord {
  type: 'player' | 'dailyAverage';
  data: PlayerDataRecord | DailyAverageSheetRecord;
  retryCount: number;
  timestamp: number;
}

export class QueuedGoogleSheetsService {
  private playerDataSheets?: GoogleSheetsService;
  private dailyAverageSheets?: GoogleSheetsService;
  private queue: QueuedRecord[] = [];
  private isProcessing: boolean = false;
  private logger: Logger;
  private maxRetries: number = 3;
  private retryInterval: number = 30000; // 30 seconds

  constructor(
    playerDataSheets?: GoogleSheetsService,
    dailyAverageSheets?: GoogleSheetsService,
    logger?: Logger
  ) {
    this.playerDataSheets = playerDataSheets;
    this.dailyAverageSheets = dailyAverageSheets;
    this.logger = logger || new Logger('info', 'logs/queued-sheets.log');
    
    // Start processing queue
    this.startQueueProcessor();
  }

  async addPlayerRecord(record: PlayerDataRecord): Promise<void> {
    if (!this.playerDataSheets) {
      throw new Error('Player data sheets service not initialized');
    }

    try {
      // Try immediate write first
      await this.playerDataSheets.appendRecord(record);
      this.logger.info(`Successfully wrote player record: ${record.timestamp}`);
    } catch (error) {
      this.logger.warn(`Failed to write player record immediately, queuing for retry: ${record.timestamp}`, { error });
      
      // Add to queue for retry
      this.queue.push({
        type: 'player',
        data: record,
        retryCount: 0,
        timestamp: Date.now()
      });
    }
  }

  async addDailyAverageRecord(record: DailyAverageSheetRecord): Promise<void> {
    if (!this.dailyAverageSheets) {
      throw new Error('Daily average sheets service not initialized');
    }

    try {
      // Try immediate write first
      await this.dailyAverageSheets.appendDailyAverageRecord(record);
      this.logger.info(`Successfully wrote daily average record: ${record.timestamp}`);
    } catch (error) {
      this.logger.warn(`Failed to write daily average record immediately, queuing for retry: ${record.timestamp}`, { error });
      
      // Add to queue for retry
      this.queue.push({
        type: 'dailyAverage',
        data: record,
        retryCount: 0,
        timestamp: Date.now()
      });
    }
  }

  private startQueueProcessor(): void {
    setInterval(async () => {
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
      
      try {
        if (queuedRecord.type === 'player') {
          await this.playerDataSheets!.appendRecord(queuedRecord.data as PlayerDataRecord);
          this.logger.info(`Successfully processed queued player record: ${(queuedRecord.data as PlayerDataRecord).timestamp}`);
        } else {
          await this.dailyAverageSheets!.appendDailyAverageRecord(queuedRecord.data as DailyAverageSheetRecord);
          this.logger.info(`Successfully processed queued daily average record: ${(queuedRecord.data as DailyAverageSheetRecord).timestamp}`);
        }
        
        processed.push(i);
      } catch (error) {
        queuedRecord.retryCount++;
        this.logger.warn(`Failed to process queued record (attempt ${queuedRecord.retryCount}/${this.maxRetries})`, { error });
        
        if (queuedRecord.retryCount >= this.maxRetries) {
          this.logger.error(`Max retries exceeded for record, removing from queue: ${JSON.stringify(queuedRecord.data)}`);
          processed.push(i);
        }
      }
    }

    // Remove processed items from queue (in reverse order to maintain indices)
    for (let i = processed.length - 1; i >= 0; i--) {
      this.queue.splice(processed[i], 1);
    }

    if (processed.length > 0) {
      this.logger.info(`Processed ${processed.length} records from queue. ${this.queue.length} records remaining.`);
    }
  }

  getQueueStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing
    };
  }

  async processQueueNow(): Promise<void> {
    if (this.isProcessing) {
      this.logger.info('Queue processing already in progress');
      return;
    }

    this.isProcessing = true;
    await this.processQueue();
    this.isProcessing = false;
  }
}