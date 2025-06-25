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

  async appendRecord(record: PlayerDataRecord): Promise<void> {
    try {
      await this.ensureHeaderExists();
      
      // Check if a record for this timestamp already exists
      const existingRowIndex = await this.findRecordByTimestamp(record.timestamp);
      
      const values = [[record.timestamp, record.playerCount]];
      
      if (existingRowIndex !== null) {
        // Update existing record
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A${existingRowIndex}:B${existingRowIndex}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: values,
          },
        });
      } else {
        // Append new record
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A:B`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: values,
          },
        });
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
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A${existingRowIndex}:G${existingRowIndex}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: values,
          },
        });
      } else {
        // Append new record
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A:G`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: values,
          },
        });
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