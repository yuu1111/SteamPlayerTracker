import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { PlayerDataRecord } from '../types/config';

import { promises as fs } from 'fs';

export interface DailyAverageSheetRecord {
  timestamp: string;
  playerCount: number;
  sampleCount: number;
  maxPlayerCount?: number;
  maxPlayerTimestamp?: string;
  minPlayerCount?: number;
  minPlayerTimestamp?: string;
}

export class GoogleSheetsService {
  private sheets!: sheets_v4.Sheets;
  private spreadsheetId: string;
  private sheetName: string;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number = 100; // 100ms between requests

  constructor(spreadsheetId: string, sheetName: string, serviceAccountKeyPath: string) {
    this.spreadsheetId = spreadsheetId;
    this.sheetName = sheetName;
    this.initializeAuth(serviceAccountKeyPath);
  }

  private async initializeAuth(serviceAccountKeyPath: string): Promise<void> {
    try {
      const keyFile = await fs.readFile(serviceAccountKeyPath, 'utf8');
      const credentials = JSON.parse(keyFile);

      const auth = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth });
    } catch (error) {
      throw new Error(`Failed to initialize Google Sheets authentication: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async rateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
    return await requestFn();
  }

  async batchAppendRecords(records: PlayerDataRecord[]): Promise<void> {
    if (records.length === 0) return;

    try {
      await this.ensureHeaderExists();
      
      // Convert records to values array
      const values = records.map(record => [record.timestamp, record.playerCount]);
      
      // Batch append all records at once
      await this.rateLimitedRequest(() =>
        this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A:B`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: values,
          },
        })
      );
    } catch (error) {
      throw new Error(`Failed to batch append records to Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async batchAppendDailyAverageRecords(records: DailyAverageSheetRecord[]): Promise<void> {
    if (records.length === 0) return;

    try {
      await this.ensureDailyAverageHeaderExists();
      
      // Convert records to values array
      const values = records.map(record => [
        record.timestamp, 
        record.playerCount, 
        record.sampleCount,
        record.maxPlayerCount || '',
        record.maxPlayerTimestamp || '',
        record.minPlayerCount || '',
        record.minPlayerTimestamp || ''
      ]);
      
      // Batch append all records at once
      await this.rateLimitedRequest(() =>
        this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A:G`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: values,
          },
        })
      );
    } catch (error) {
      throw new Error(`Failed to batch append daily average records to Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async replaceAllRecords(records: PlayerDataRecord[]): Promise<void> {
    try {
      // Clear existing data (keep header)
      await this.clearSheetData();
      
      if (records.length === 0) return;
      
      // Sort records by timestamp
      const sortedRecords = [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      
      // Convert to values array with header
      const values = [
        ['timestamp (UTC)', 'player_count'], // Header
        ...sortedRecords.map(record => [record.timestamp, record.playerCount])
      ];
      
      // Replace all data
      await this.rateLimitedRequest(() =>
        this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A:B`,
          valueInputOption: 'RAW',
          requestBody: {
            values: values,
          },
        })
      );
    } catch (error) {
      throw new Error(`Failed to replace all records in Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async replaceAllDailyAverageRecords(records: DailyAverageSheetRecord[]): Promise<void> {
    try {
      // Clear existing data (keep header)
      await this.clearDailyAverageSheetData();
      
      if (records.length === 0) return;
      
      // Sort records by date
      const sortedRecords = [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      
      // Convert to values array with header
      const values = [
        [
          'date (UTC)', 
          'average_player_count', 
          'sample_count', 
          'max_player_count', 
          'max_timestamp (UTC)', 
          'min_player_count', 
          'min_timestamp (UTC)'
        ], // Header
        ...sortedRecords.map(record => [
          record.timestamp, 
          record.playerCount, 
          record.sampleCount,
          record.maxPlayerCount || '',
          record.maxPlayerTimestamp || '',
          record.minPlayerCount || '',
          record.minPlayerTimestamp || ''
        ])
      ];
      
      // Replace all data
      await this.rateLimitedRequest(() =>
        this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A:G`,
          valueInputOption: 'RAW',
          requestBody: {
            values: values,
          },
        })
      );
    } catch (error) {
      throw new Error(`Failed to replace all daily average records in Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async clearSheetData(): Promise<void> {
    try {
      // Get the range of existing data
      const response = await this.rateLimitedRequest(() =>
        this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A:B`,
        })
      );
      
      const rowCount = response.data.values?.length || 0;
      if (rowCount > 1) {
        // Clear data rows (keep header)
        await this.rateLimitedRequest(() =>
          this.sheets.spreadsheets.values.clear({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!A2:B${rowCount}`,
          })
        );
      }
    } catch (error) {
      // If sheet doesn't exist or is empty, that's ok
      if (!(error instanceof Error && error.message.includes('Unable to parse range'))) {
        throw error;
      }
    }
  }

  private async clearDailyAverageSheetData(): Promise<void> {
    try {
      // Get the range of existing data
      const response = await this.rateLimitedRequest(() =>
        this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A:G`,
        })
      );
      
      const rowCount = response.data.values?.length || 0;
      if (rowCount > 1) {
        // Clear data rows (keep header)
        await this.rateLimitedRequest(() =>
          this.sheets.spreadsheets.values.clear({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!A2:G${rowCount}`,
          })
        );
      }
    } catch (error) {
      // If sheet doesn't exist or is empty, that's ok
      if (!(error instanceof Error && error.message.includes('Unable to parse range'))) {
        throw error;
      }
    }
  }

  async appendRecord(record: PlayerDataRecord): Promise<void> {
    try {
      await this.ensureHeaderExists();
      
      // Check if a record for this timestamp already exists
      const existingRowIndex = await this.findRecordByTimestamp(record.timestamp);
      
      const values = [[record.timestamp, record.playerCount]];
      
      if (existingRowIndex !== null) {
        // Update existing record
        await this.rateLimitedRequest(() =>
          this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!A${existingRowIndex}:B${existingRowIndex}`,
            valueInputOption: 'RAW',
            requestBody: {
              values: values,
            },
          })
        );
      } else {
        // Append new record (order will be maintained by sync tool if needed)
        await this.rateLimitedRequest(() =>
          this.sheets.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!A:B`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
              values: values,
            },
          })
        );
      }
    } catch (error) {
      throw new Error(`Failed to append/update record to Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async findRecordByTimestamp(timestamp: string): Promise<number | null> {
    try {
      // Get all values from the timestamp column (column A)
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:A`,
      });

      const values = response.data.values;
      if (!values || values.length <= 1) {
        return null;
      }

      // Search for the timestamp in the column (skip header at index 0)
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === timestamp) {
          return i + 1; // Return 1-based row index for Google Sheets
        }
      }

      return null;
    } catch (error) {
      // If the sheet doesn't exist yet, return null
      if (error instanceof Error && error.message.includes('Unable to parse range')) {
        return null;
      }
      throw error;
    }
  }

  private async ensureHeaderExists(): Promise<void> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A1:B1`,
      });

      const values = response.data.values;
      if (!values || values.length === 0 || (values[0][0] !== 'timestamp' && values[0][0] !== 'timestamp (UTC)')) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A1:B1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['timestamp (UTC)', 'player_count']],
          },
        });
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unable to parse range')) {
        await this.createSheet();
        await this.ensureHeaderExists();
      } else {
        throw error;
      }
    }
  }

  async appendDailyAverageRecord(record: DailyAverageSheetRecord): Promise<void> {
    try {
      await this.ensureDailyAverageHeaderExists();
      
      // Check if a record for this date already exists
      const existingRowIndex = await this.findDailyAverageRecordByDate(record.timestamp);
      
      const values = [[
        record.timestamp, 
        record.playerCount, 
        record.sampleCount,
        record.maxPlayerCount || '',
        record.maxPlayerTimestamp || '',
        record.minPlayerCount || '',
        record.minPlayerTimestamp || ''
      ]];
      
      if (existingRowIndex !== null) {
        // Update existing record
        await this.rateLimitedRequest(() =>
          this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!A${existingRowIndex}:G${existingRowIndex}`,
            valueInputOption: 'RAW',
            requestBody: {
              values: values,
            },
          })
        );
      } else {
        // Append new record (order will be maintained by sync tool if needed)
        await this.rateLimitedRequest(() =>
          this.sheets.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!A:G`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
              values: values,
            },
          })
        );
      }
    } catch (error) {
      throw new Error(`Failed to append/update daily average record to Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async findDailyAverageRecordByDate(date: string): Promise<number | null> {
    try {
      // Get all values from the date column (column A)
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:A`,
      });

      const values = response.data.values;
      if (!values || values.length <= 1) {
        return null;
      }

      // Search for the date in the column (skip header at index 0)
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === date) {
          return i + 1; // Return 1-based row index for Google Sheets
        }
      }

      return null;
    } catch (error) {
      // If the sheet doesn't exist yet, return null
      if (error instanceof Error && error.message.includes('Unable to parse range')) {
        return null;
      }
      throw error;
    }
  }

  private async ensureDailyAverageHeaderExists(): Promise<void> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A1:G1`,
      });

      const values = response.data.values;
      if (!values || values.length === 0 || (values[0][0] !== 'date' && values[0][0] !== 'date (UTC)')) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A1:G1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[
              'date (UTC)', 
              'average_player_count', 
              'sample_count', 
              'max_player_count', 
              'max_timestamp (UTC)', 
              'min_player_count', 
              'min_timestamp (UTC)'
            ]],
          },
        });
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unable to parse range')) {
        await this.createSheet();
        await this.ensureDailyAverageHeaderExists();
      } else {
        throw error;
      }
    }
  }

  private async createSheet(): Promise<void> {
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: this.sheetName,
              },
            },
          }],
        },
      });
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('already exists'))) {
        throw error;
      }
    }
  }
}