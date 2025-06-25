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
  
  // Parse and sort records by timestamp
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
  
  // Sort records by timestamp (oldest first)
  records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  logger.info(`Sorted ${records.length} records by timestamp`);
  
  // Process in batches to avoid rate limits and maintain order
  const batchSize = 100;
  const totalBatches = Math.ceil(records.length / batchSize);
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, records.length);
    const batch = records.slice(start, end);
    
    logger.info(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} records)`);
    
    // Process each record in the batch individually to handle duplicates
    for (let i = 0; i < batch.length; i++) {
      try {
        await googleSheets.appendRecord(batch[i]);
        
        // Log progress every 50 records across all batches
        const totalProcessed = start + i + 1;
        if (totalProcessed % 50 === 0) {
          logger.info(`Synced ${totalProcessed} / ${records.length} records`);
        }
        
        // Add small delay between individual records
        if (i < batch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (error) {
        logger.error(`Failed to sync record ${start + i + 1}: ${error}`);
        // Add longer delay on error
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Add delay between batches
    if (batchIndex < totalBatches - 1) {
      logger.info(`Batch ${batchIndex + 1} completed, waiting before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  logger.info('Player data sync completed');
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
  
  // Sort records by date (oldest first)
  records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  logger.info(`Sorted ${records.length} daily average records by date`);
  
  // Sync records with rate limiting (daily averages are smaller, process individually)
  for (let i = 0; i < records.length; i++) {
    try {
      await googleSheets.appendDailyAverageRecord(records[i]);
      logger.info(`Synced daily average for ${records[i].timestamp} (${i + 1}/${records.length})`);
      
      // Add delay to avoid rate limits (300ms between requests for daily averages)
      if (i < records.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      logger.error(`Failed to sync daily average for ${records[i].timestamp}: ${error}`);
      // Add longer delay on error
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  logger.info('Daily average sync completed');
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