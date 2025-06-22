import { config } from './config/config';
import { SteamApiService } from './services/steamApi';
import { CsvWriter } from './services/csvWriter';
import { GoogleSheetsService } from './services/googleSheets';
import { Scheduler } from './services/scheduler';
import { RetryHandler } from './utils/retry';
import { Logger } from './utils/logger';
import { PlayerDataRecord } from './types/config';

export class SteamPlayerTracker {
  private steamApi: SteamApiService;
  private csvWriter: CsvWriter;
  private googleSheets?: GoogleSheetsService;
  private scheduler: Scheduler;
  private retryHandler: RetryHandler;
  private logger: Logger;

  constructor() {
    this.logger = new Logger(config.logging.level, config.logging.filePath);
    this.steamApi = new SteamApiService();
    this.csvWriter = new CsvWriter(config.output.csvFilePath);
    this.scheduler = new Scheduler();
    this.retryHandler = new RetryHandler(config.retry.maxRetries, config.retry.baseDelay);

    if (config.googleSheets?.enabled) {
      this.googleSheets = new GoogleSheetsService(
        config.googleSheets.spreadsheetId!,
        config.googleSheets.sheetName!,
        config.googleSheets.serviceAccountKeyPath!
      );
    }
  }

  async start(): Promise<void> {
    try {
      this.logger.info('Steam Player Tracker starting...', {
        appId: config.steam.appId,
        scheduledMinutes: config.scheduling.collectionMinutes,
        csvEnabled: config.output.csvEnabled,
        googleSheetsEnabled: config.googleSheets?.enabled || false,
      });

      await this.validateConfiguration();

      this.scheduler.scheduleDataCollection(
        config.scheduling.collectionMinutes,
        () => this.collectAndSaveData()
      );

      this.setupGracefulShutdown();

      this.logger.info('Steam Player Tracker started successfully');
      console.log(`🚀 Steam Player Tracker is running!`);
      console.log(`📊 Tracking App ID: ${config.steam.appId}`);
      console.log(`⏰ Collection schedule: every hour at minutes ${config.scheduling.collectionMinutes.join(', ')}`);
      console.log(`📁 CSV output: ${config.output.csvEnabled ? config.output.csvFilePath : 'disabled'}`);
      console.log(`📋 Google Sheets: ${config.googleSheets?.enabled ? 'enabled' : 'disabled'}`);
      console.log(`🔄 Press Ctrl+C to stop`);

    } catch (error) {
      this.logger.error('Failed to start Steam Player Tracker', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private async validateConfiguration(): Promise<void> {
    try {
      this.logger.info('Validating configuration...');
      
      const playerCount = await this.retryHandler.executeWithRetry(
        () => this.steamApi.getCurrentPlayerCount(config.steam.appId),
        'Steam API test'
      );

      this.logger.info('Configuration validated successfully', { 
        testPlayerCount: playerCount 
      });
    } catch (error) {
      throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async collectAndSaveData(): Promise<void> {
    try {
      this.logger.info('Starting data collection...');

      const playerCount = await this.retryHandler.executeWithRetry(
        () => this.steamApi.getCurrentPlayerCount(config.steam.appId),
        'Steam API data collection'
      );

      const record: PlayerDataRecord = {
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        playerCount,
      };

      const savePromises: Promise<void>[] = [];

      if (config.output.csvEnabled) {
        savePromises.push(
          this.retryHandler.executeWithRetry(
            () => this.csvWriter.writeRecord(record),
            'CSV write'
          )
        );
      }

      if (config.googleSheets?.enabled && this.googleSheets) {
        savePromises.push(
          this.retryHandler.executeWithRetry(
            () => this.googleSheets!.appendRecord(record),
            'Google Sheets write'
          )
        );
      }

      await Promise.all(savePromises);

      this.logger.info('Data collection completed successfully', {
        timestamp: record.timestamp,
        playerCount: record.playerCount,
        csvSaved: config.output.csvEnabled,
        sheetsSaved: config.googleSheets?.enabled || false,
      });

    } catch (error) {
      this.logger.error('Data collection failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      this.logger.info(`Received ${signal}. Shutting down gracefully...`);
      
      this.scheduler.stopAll();
      
      this.logger.info('Steam Player Tracker stopped');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}