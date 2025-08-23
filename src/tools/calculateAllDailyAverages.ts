import { promises as fs } from 'fs';
import { config } from '../config/config';
import { DailyAverageService } from '../services/dailyAverageService';
import { GoogleSheetsService } from '../services/googleSheets';
import { createLogger } from '../utils/logger';

async function calculateAllDailyAverages() {
  const logger = createLogger('calculate-daily-averages');
  
  try {
    logger.info('Starting calculation of all daily averages...');
    
    // Initialize the daily average service without Google Sheets integration
    // We'll handle Google Sheets upload separately as a bulk operation
    const dailyAverageService = new DailyAverageService(
      config.output.csvFilePath,
      config.output.dailyAverageCsvFilePath,
      logger
      // Note: Not passing queuedGoogleSheets to avoid individual writes
    );
    
    // Calculate all daily averages and save to CSV only
    await dailyAverageService.updateAllDailyAverages();
    
    // If Google Sheets is enabled, do a bulk upload of all data
    if (config.googleSheets?.enabled && config.output.dailyAverageCsvEnabled) {
      logger.info('Starting bulk upload to Google Sheets...');
      
      const dailyAverageGoogleSheets = new GoogleSheetsService(
        config.googleSheets.spreadsheetId!,
        config.googleSheets.dailyAverageSheetName!,
        config.googleSheets.serviceAccountKeyPath!
      );
      
      // Read all calculated daily averages from CSV
      const csvContent = await fs.readFile(config.output.dailyAverageCsvFilePath, 'utf8');
      const lines = csvContent.trim().split('\n');
      
      if (lines.length <= 1) {
        logger.warn('No daily average data to upload to Google Sheets');
      } else {
        // Parse CSV data
        const header = lines[0].split(',');
        const hasExtendedData = header.length > 3;
        
        const records = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',');
          
          if (row.length >= 3) {
            const record = {
              timestamp: row[0].trim(),
              playerCount: parseInt(row[1].trim(), 10),
              sampleCount: parseInt(row[2].trim(), 10),
              maxPlayerCount: hasExtendedData && row[3] ? parseInt(row[3].trim(), 10) : undefined,
              maxPlayerTimestamp: hasExtendedData && row[4] ? row[4].trim() : undefined,
              minPlayerCount: hasExtendedData && row[5] ? parseInt(row[5].trim(), 10) : undefined,
              minPlayerTimestamp: hasExtendedData && row[6] ? row[6].trim() : undefined
            };
            
            if (!isNaN(record.playerCount) && !isNaN(record.sampleCount)) {
              records.push(record);
            }
          }
        }
        
        logger.info(`Uploading ${records.length} daily average records to Google Sheets...`);
        
        // Replace all data in Google Sheets with the calculated data
        await dailyAverageGoogleSheets.replaceAllDailyAverageRecords(records);
        
        logger.info('Bulk upload to Google Sheets completed successfully');
      }
    }
    
    logger.info('All daily averages calculated successfully');
    console.log('✅ All daily averages have been calculated successfully!');
    
    // Explicitly exit to ensure all connections are closed
    process.exit(0);
    
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