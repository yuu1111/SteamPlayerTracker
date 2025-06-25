import { promises as fs } from 'fs';
import { dirname } from 'path';
import { PlayerDataRecord } from '../types/config';

export class CsvWriter {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async writeRecord(record: PlayerDataRecord): Promise<void> {
    try {
      await this.ensureDirectoryExists();
      
      const fileExists = await this.fileExists();
      const csvLine = `${record.timestamp},${record.playerCount}\n`;

      if (!fileExists) {
        const header = 'timestamp,player_count\n';
        await fs.writeFile(this.filePath, header + csvLine, 'utf8');
      } else {
        await fs.appendFile(this.filePath, csvLine, 'utf8');
      }
    } catch (error) {
      throw new Error(`Failed to write CSV record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async writeDailyAverageRecord(
    date: string, 
    averagePlayerCount: number, 
    sampleCount: number,
    maxPlayerCount?: number,
    maxPlayerTimestamp?: string,
    minPlayerCount?: number,
    minPlayerTimestamp?: string
  ): Promise<void> {
    try {
      await this.ensureDirectoryExists();
      
      const fileExists = await this.fileExists();
      
      // Build CSV line based on available data
      let csvLine: string;
      if (maxPlayerCount !== undefined && maxPlayerTimestamp && minPlayerCount !== undefined && minPlayerTimestamp) {
        csvLine = `${date},${averagePlayerCount},${sampleCount},${maxPlayerCount},${maxPlayerTimestamp},${minPlayerCount},${minPlayerTimestamp}\n`;
      } else {
        // Backward compatibility: only write basic data if max/min not provided
        csvLine = `${date},${averagePlayerCount},${sampleCount}\n`;
      }

      if (!fileExists) {
        const header = maxPlayerCount !== undefined 
          ? 'date,average_player_count,sample_count,max_player_count,max_timestamp,min_player_count,min_timestamp\n'
          : 'date,average_player_count,sample_count\n';
        await fs.writeFile(this.filePath, header + csvLine, 'utf8');
      } else {
        await fs.appendFile(this.filePath, csvLine, 'utf8');
      }
    } catch (error) {
      throw new Error(`Failed to write daily average CSV record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fileExists(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureDirectoryExists(): Promise<void> {
    const dir = dirname(this.filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}