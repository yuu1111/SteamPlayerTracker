import * as dotenv from 'dotenv';
import { Config } from '../types/config';

dotenv.config();

function parseMinutes(minutesStr: string): number[] {
  return minutesStr.split(',').map(m => parseInt(m.trim(), 10)).filter(m => !isNaN(m) && m >= 0 && m < 60);
}

function validateConfig(): Config {
  const steamAppId = process.env.STEAM_APP_ID;

  if (!steamAppId || isNaN(parseInt(steamAppId))) {
    throw new Error('STEAM_APP_ID must be a valid number in environment variables');
  }

  const config: Config = {
    steam: {
      appId: parseInt(steamAppId),
    },
    
    output: {
      csvEnabled: process.env.CSV_OUTPUT_ENABLED !== 'false',
      csvFilePath: process.env.CSV_FILE_PATH || 'steam_concurrent_players.csv',
    },
    
    scheduling: {
      collectionMinutes: parseMinutes(process.env.COLLECTION_MINUTES || '0,30'),
    },
    
    retry: {
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      baseDelay: parseInt(process.env.RETRY_BASE_DELAY || '1000'),
    },
    
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      filePath: process.env.LOG_FILE_PATH || 'logs/steam-tracker.log',
    },
  };

  if (process.env.GOOGLE_SHEETS_ENABLED === 'true') {
    config.googleSheets = {
      enabled: true,
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || 'PlayerData',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    };

    if (!config.googleSheets.spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is required when Google Sheets is enabled');
    }

    if (!config.googleSheets.serviceAccountKeyPath) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_PATH is required when Google Sheets is enabled');
    }
  } else {
    config.googleSheets = {
      enabled: false,
    };
  }

  return config;
}

export const config = validateConfig();