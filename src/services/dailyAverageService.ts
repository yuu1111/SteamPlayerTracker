import { promises as fs } from 'fs';
import { CsvWriter } from './csvWriter';
import { QueuedGoogleSheetsService } from './queuedGoogleSheets';
import { PlayerDataRecord } from '../types/config';
import { Logger } from '../utils/logger';

export interface DailyAverageRecord {
  date: string;
  averagePlayerCount: number;
  sampleCount: number;
  maxPlayerCount: number;
  maxPlayerTimestamp: string;
  minPlayerCount: number;
  minPlayerTimestamp: string;
}

export class DailyAverageService {
  private csvWriter: CsvWriter;
  private dailyAverageCsvPath: string;
  private queuedGoogleSheets?: QueuedGoogleSheetsService;
  private logger: Logger;
  private sourceCsvPath: string;

  constructor(
    sourceCsvPath: string,
    dailyAverageCsvPath: string,
    logger: Logger,
    queuedGoogleSheets?: QueuedGoogleSheetsService
  ) {
    this.sourceCsvPath = sourceCsvPath;
    this.dailyAverageCsvPath = dailyAverageCsvPath;
    this.csvWriter = new CsvWriter(dailyAverageCsvPath);
    this.queuedGoogleSheets = queuedGoogleSheets;
    this.logger = logger;
  }

  async calculateAndSaveDailyAverage(date: Date): Promise<void> {
    try {
      const dateStr = date.toISOString().split('T')[0];
      this.logger.info(`Calculating daily average for ${dateStr}`);

      const dailyData = await this.readDailyData(dateStr);
      
      if (dailyData.length === 0) {
        this.logger.warn(`No data found for ${dateStr}`);
        return;
      }

      // Filter out 0 values as requested
      const validData = dailyData.filter(record => record.playerCount > 0);
      
      if (validData.length === 0) {
        this.logger.warn(`No valid data (non-zero) found for ${dateStr}`);
        return;
      }

      const sum = validData.reduce((acc, record) => acc + record.playerCount, 0);
      const average = Math.round(sum / validData.length);

      // Find max and min values with their timestamps
      let maxRecord = validData[0];
      let minRecord = validData[0];
      
      for (const record of validData) {
        if (record.playerCount > maxRecord.playerCount) {
          maxRecord = record;
        }
        if (record.playerCount < minRecord.playerCount) {
          minRecord = record;
        }
      }

      const averageRecord: DailyAverageRecord = {
        date: dateStr,
        averagePlayerCount: average,
        sampleCount: validData.length,
        maxPlayerCount: maxRecord.playerCount,
        maxPlayerTimestamp: maxRecord.timestamp,
        minPlayerCount: minRecord.playerCount,
        minPlayerTimestamp: minRecord.timestamp
      };

      await this.saveAverageRecord(averageRecord);
      
      this.logger.info(`Daily average calculated successfully for ${dateStr}`, {
        average,
        sampleCount: validData.length,
        excludedZeros: dailyData.length - validData.length,
        max: averageRecord.maxPlayerCount,
        maxTime: averageRecord.maxPlayerTimestamp,
        min: averageRecord.minPlayerCount,
        minTime: averageRecord.minPlayerTimestamp
      });

    } catch (error) {
      this.logger.error(`Failed to calculate daily average: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async readDailyData(dateStr: string): Promise<PlayerDataRecord[]> {
    try {
      const csvContent = await fs.readFile(this.sourceCsvPath, 'utf8');
      const lines = csvContent.trim().split('\n');
      
      if (lines.length <= 1) {
        return [];
      }

      const records: PlayerDataRecord[] = [];
      
      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const [timestamp, playerCountStr] = lines[i].split(',');
        
        if (timestamp && timestamp.startsWith(dateStr)) {
          const playerCount = parseInt(playerCountStr, 10);
          if (!isNaN(playerCount)) {
            records.push({
              timestamp: timestamp.trim(),
              playerCount
            });
          }
        }
      }

      return records;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as {code: string}).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async saveAverageRecord(record: DailyAverageRecord): Promise<void> {
    const savePromises: Promise<void>[] = [];

    // Save to CSV with all data including max/min
    savePromises.push(
      this.csvWriter.writeDailyAverageRecord(
        record.date,
        record.averagePlayerCount,
        record.sampleCount,
        record.maxPlayerCount,
        record.maxPlayerTimestamp,
        record.minPlayerCount,
        record.minPlayerTimestamp
      )
    );

    // Save to Google Sheets if enabled
    if (this.queuedGoogleSheets) {
      const sheetsRecord = {
        timestamp: record.date,
        playerCount: record.averagePlayerCount,
        sampleCount: record.sampleCount,
        maxPlayerCount: record.maxPlayerCount,
        maxPlayerTimestamp: record.maxPlayerTimestamp,
        minPlayerCount: record.minPlayerCount,
        minPlayerTimestamp: record.minPlayerTimestamp
      };
      savePromises.push(
        this.queuedGoogleSheets.addDailyAverageRecord(sheetsRecord)
      );
    }

    await Promise.all(savePromises);
  }

  async updateAllDailyAverages(): Promise<void> {
    try {
      this.logger.info('Updating all daily averages...');
      
      const csvContent = await fs.readFile(this.sourceCsvPath, 'utf8');
      const lines = csvContent.trim().split('\n');
      
      if (lines.length <= 1) {
        this.logger.warn('No data to process');
        return;
      }

      const dates = new Set<string>();
      
      // Skip header and collect unique dates
      for (let i = 1; i < lines.length; i++) {
        const [timestamp] = lines[i].split(',');
        if (timestamp) {
          const date = timestamp.split(' ')[0];
          dates.add(date);
        }
      }

      // Calculate average for each date
      for (const dateStr of dates) {
        const date = new Date(dateStr);
        await this.calculateAndSaveDailyAverage(date);
      }

      this.logger.info(`Updated daily averages for ${dates.size} days`);
    } catch (error) {
      this.logger.error(`Failed to update all daily averages: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  async checkAndCalculateMissingAverages(): Promise<void> {
    try {
      this.logger.info('Checking for missing daily averages...');
      
      // Read source data to get all available dates
      const sourceContent = await fs.readFile(this.sourceCsvPath, 'utf8');
      const sourceLines = sourceContent.trim().split('\n');
      
      if (sourceLines.length <= 1) {
        this.logger.info('No source data to process');
        return;
      }
      
      const sourceDates = new Set<string>();
      const today = new Date().toISOString().split('T')[0];
      
      // Collect all dates from source data (excluding today)
      for (let i = 1; i < sourceLines.length; i++) {
        const [timestamp] = sourceLines[i].split(',');
        if (timestamp) {
          const date = timestamp.split(' ')[0];
          if (date < today) {
            sourceDates.add(date);
          }
        }
      }
      
      // Read existing daily averages
      const existingAverages = new Set<string>();
      try {
        const averageContent = await fs.readFile(this.dailyAverageCsvPath, 'utf8');
        const averageLines = averageContent.trim().split('\n');
        
        for (let i = 1; i < averageLines.length; i++) {
          const [date] = averageLines[i].split(',');
          if (date) {
            existingAverages.add(date.trim());
          }
        }
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && (error as {code: string}).code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist yet, that's ok
      }
      
      // Find missing dates
      const missingDates = Array.from(sourceDates).filter(date => !existingAverages.has(date)).sort();
      
      if (missingDates.length === 0) {
        this.logger.info('All daily averages are up to date');
        return;
      }
      
      this.logger.info(`Found ${missingDates.length} missing daily averages`);
      
      // Calculate missing averages
      for (const dateStr of missingDates) {
        const date = new Date(dateStr);
        await this.calculateAndSaveDailyAverage(date);
      }
      
      this.logger.info(`Calculated ${missingDates.length} missing daily averages`);
    } catch (error) {
      this.logger.error(`Failed to check missing averages: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}