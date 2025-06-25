export interface Config {
  steam: {
    appId: number;
  };
  
  output: {
    csvEnabled: boolean;
    csvFilePath: string;
    dailyAverageCsvEnabled: boolean;
    dailyAverageCsvFilePath: string;
  };
  
  scheduling: {
    collectionMinutes: number[];
    dailyAverageHour: number;
  };
  
  retry: {
    maxRetries: number;
    baseDelay: number;
  };
  
  logging: {
    level: string;
    filePath: string;
  };
  
  googleSheets?: {
    enabled: boolean;
    spreadsheetId?: string;
    sheetName?: string;
    dailyAverageSheetName?: string;
    serviceAccountKeyPath?: string;
    syncOnStartup?: boolean;
  };
}

export interface SteamApiResponse {
  response: {
    player_count: number;
  };
}

export interface PlayerDataRecord {
  timestamp: string;
  playerCount: number;
}