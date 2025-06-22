export interface Config {
  steam: {
    appId: number;
  };
  
  output: {
    csvEnabled: boolean;
    csvFilePath: string;
  };
  
  scheduling: {
    collectionMinutes: number[];
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
    serviceAccountKeyPath?: string;
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