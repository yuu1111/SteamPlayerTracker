import { config } from '../config/config';
import { DailyAverageService } from '../services/dailyAverageService';
import { GoogleSheetsService } from '../services/googleSheets';
import { QueuedGoogleSheetsService } from '../services/queuedGoogleSheets';
import { Logger } from '../utils/logger';

async function calculateAllDailyAverages() {
  const logger = new Logger('info', 'logs/daily-average-calculation.log');
  
  try {
    logger.info('Starting calculation of all daily averages...');
    
    let queuedGoogleSheets: QueuedGoogleSheetsService | undefined;
    
    if (config.googleSheets?.enabled && config.output.dailyAverageCsvEnabled) {
      const dailyAverageGoogleSheets = new GoogleSheetsService(
        config.googleSheets.spreadsheetId!,
        config.googleSheets.dailyAverageSheetName!,
        config.googleSheets.serviceAccountKeyPath!
      );
      
      queuedGoogleSheets = new QueuedGoogleSheetsService(
        undefined,
        dailyAverageGoogleSheets,
        logger
      );
    }
    
    const dailyAverageService = new DailyAverageService(
      config.output.csvFilePath,
      config.output.dailyAverageCsvFilePath,
      logger,
      queuedGoogleSheets
    );
    
    await dailyAverageService.updateAllDailyAverages();
    
    logger.info('All daily averages calculated successfully');
    console.log('✅ All daily averages have been calculated successfully!');
    
  } catch (error) {
    logger.error(`Failed to calculate daily averages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('❌ Failed to calculate daily averages:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  calculateAllDailyAverages();
}