import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { PlayerDataRecord } from '../types/config';
import { promises as fs } from 'fs';

export class GoogleSheetsService {
  private sheets: any;
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
        resource: {
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
      if (!values || values.length === 0 || values[0][0] !== 'timestamp') {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A1:B1`,
          valueInputOption: 'RAW',
          resource: {
            values: [['timestamp', 'player_count']],
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

  private async createSheet(): Promise<void> {
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
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