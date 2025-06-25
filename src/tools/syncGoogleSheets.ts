import { promises as fs } from 'fs';
import { resolve } from 'path';
import { GoogleSheetsService } from '../services/googleSheets';
import { Logger } from '../utils/logger';
import { config } from '../config/config';
import { PlayerDataRecord } from '../types/config';

const logger = new Logger('info', 'logs/sync-sheets.log');

async function readCsvFile(filePath: string): Promise<string[][]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n');
    return lines.map(line => line.split(',').map(cell => cell.trim()));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function syncPlayerData(googleSheets: GoogleSheetsService): Promise<void> {
  const csvPath = resolve(__dirname, '../../steam_concurrent_players.csv');
  const csvData = await readCsvFile(csvPath);
  
  if (csvData.length <= 1) {
    logger.info('No player data to sync');
    return;
  }

  logger.info(`Found ${csvData.length - 1} records in CSV`);
  
  // Parse records
  const records: PlayerDataRecord[] = [];
  for (let i = 1; i < csvData.length; i++) {
    const [timestamp, playerCount] = csvData[i];
    
    if (timestamp && playerCount) {
      const record: PlayerDataRecord = {
        timestamp: timestamp,
        playerCount: parseInt(playerCount, 10)
      };
      
      if (!isNaN(record.playerCount)) {
        records.push(record);
      }
    }
  }
  
  logger.info(`Parsed ${records.length} valid records`);
  
  // Replace all data with sorted records (no read requests, just write)
  logger.info('Replacing all Google Sheets data with sorted CSV data...');
  await googleSheets.replaceAllRecords(records);
  
  logger.info('Player data sync completed - all data replaced and sorted');
}

async function syncDailyAverages(googleSheets: GoogleSheetsService): Promise<void> {
  const csvPath = resolve(__dirname, '../../steam_daily_averages.csv');
  const csvData = await readCsvFile(csvPath);
  
  if (csvData.length <= 1) {
    logger.info('No daily average data to sync');
    return;
  }

  logger.info(`Found ${csvData.length - 1} daily average records in CSV`);
  
  // Determine CSV format by checking header columns
  const header = csvData[0];
  const hasExtendedData = header.length > 3;
  
  // Parse records
  const records = [];
  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    
    if (row.length >= 3) {
      const record = {
        timestamp: row[0],
        playerCount: parseInt(row[1], 10),
        sampleCount: parseInt(row[2], 10),
        maxPlayerCount: hasExtendedData && row[3] ? parseInt(row[3], 10) : undefined,
        maxPlayerTimestamp: hasExtendedData && row[4] ? row[4] : undefined,
        minPlayerCount: hasExtendedData && row[5] ? parseInt(row[5], 10) : undefined,
        minPlayerTimestamp: hasExtendedData && row[6] ? row[6] : undefined
      };
      
      if (!isNaN(record.playerCount) && !isNaN(record.sampleCount)) {
        records.push(record);
      }
    }
  }
  
  logger.info(`Parsed ${records.length} valid daily average records`);
  
  // Replace all data with sorted records (no read requests, just write)
  logger.info('Replacing all Google Sheets daily average data with sorted CSV data...');
  await googleSheets.replaceAllDailyAverageRecords(records);
  
  logger.info('Daily average sync completed - all data replaced and sorted');
}

async function main(): Promise<void> {
  try {
    if (!config.googleSheets?.enabled) {
      logger.error('Google Sheets is not enabled in configuration');
      console.error('❌ Google Sheets is not enabled. Set GOOGLE_SHEETS_ENABLED=true in .env');
      process.exit(1);
    }

    logger.info('Starting Google Sheets sync...');
    
    // Initialize Google Sheets service for player data
    const playerDataSheets = new GoogleSheetsService(
      config.googleSheets.spreadsheetId!,
      config.googleSheets.sheetName!,
      config.googleSheets.serviceAccountKeyPath!
    );
    
    // Initialize Google Sheets service for daily averages
    const dailyAverageSheets = new GoogleSheetsService(
      config.googleSheets.spreadsheetId!,
      config.googleSheets.dailyAverageSheetName!,
      config.googleSheets.serviceAccountKeyPath!
    );
    
    // Sync player data
    logger.info('Syncing player data...');
    await syncPlayerData(playerDataSheets);
    
    // Sync daily averages
    logger.info('Syncing daily averages...');
    await syncDailyAverages(dailyAverageSheets);
    
    logger.info('All data synced successfully');
    console.log('✅ Google Sheets sync completed successfully!');
    
  } catch (error) {
    logger.error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(`❌ Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { syncPlayerData, syncDailyAverages };