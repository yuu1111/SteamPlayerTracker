import winston from 'winston';
import { dirname } from 'path';
import { promises as fs } from 'fs';

export class Logger {
  private logger: winston.Logger;

  constructor(logLevel: string, logFilePath: string) {
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'steam-player-tracker' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ],
    });

    this.setupFileLogging(logFilePath);
  }

  private async setupFileLogging(logFilePath: string): Promise<void> {
    try {
      const logDir = dirname(logFilePath);
      await fs.mkdir(logDir, { recursive: true });

      this.logger.add(
        new winston.transports.File({
          filename: logFilePath,
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
          tailable: true,
        })
      );
    } catch (error) {
      this.logger.warn(`Failed to setup file logging: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }
}