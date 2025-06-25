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
      
      const values = [[record.timestamp, record.playerCount]];
      
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:B`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: values,
        },
      });
    } catch (error) {
      throw new Error(`Failed to append record to Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      
      const values = [[
        record.timestamp, 
        record.playerCount, 
        record.sampleCount,
        record.maxPlayerCount || '',
        record.maxPlayerTimestamp || '',
        record.minPlayerCount || '',
        record.minPlayerTimestamp || ''
      ]];
      
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:G`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: values,
        },
      });
    } catch (error) {
      throw new Error(`Failed to append daily average record to Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
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