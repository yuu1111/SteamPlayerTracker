import winston from 'winston';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

/**
 * セッション固定のディレクトリにログを保存するカスタムトランスポート
 * ./logs/sessions/YYYY-MM-DD-HHmm/app.log 形式で保存
 * 起動時のUTC時刻を基準にし、セッション中は同じディレクトリとファイルを使用
 */
export class SessionFileTransport extends winston.transports.File {
  protected sessionDirName: string;
  protected baseLogsDir: string;

  constructor(options: winston.transports.FileTransportOptions & { baseDir?: string }) {
    const currentTime = dayjs.utc();
    const dirName = currentTime.format('YYYY-MM-DD-HHmm');
    const baseDir = options.baseDir ?? path.join(process.cwd(), 'logs');
    const logPath = path.join(baseDir, 'sessions', dirName, 'app.log');

    // ディレクトリを作成
    const dirPath = path.dirname(logPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    super({
      ...options,
      filename: logPath,
    });

    this.sessionDirName = dirName;
    this.baseLogsDir = baseDir;
  }
}

/**
 * エラー専用のセッション固定ファイルトランスポート
 * ./logs/sessions/YYYY-MM-DD-HHmm/error.log 形式で保存
 */
export class SessionErrorFileTransport extends SessionFileTransport {
  constructor(options?: winston.transports.FileTransportOptions & { baseDir?: string }) {
    const currentTime = dayjs.utc();
    const dirName = currentTime.format('YYYY-MM-DD-HHmm');
    const baseDir = options?.baseDir ?? path.join(process.cwd(), 'logs');
    const logPath = path.join(baseDir, 'sessions', dirName, 'error.log');

    super({
      ...options,
      filename: logPath,
      level: 'error',
    });
  }
}

/**
 * 古いセッションログディレクトリを削除するユーティリティ関数
 * ./logs/sessions/内のYYYY-MM-DD-HHmm形式のディレクトリを削除
 * @param daysToKeep 保持する日数（デフォルト: 7日）
 */
export function cleanOldLogs(daysToKeep = 7): void {
  const sessionsDir = path.join(process.cwd(), 'logs', 'sessions');

  if (!fs.existsSync(sessionsDir)) {
    return;
  }

  const now = dayjs.utc();
  const cutoffDate = now.subtract(daysToKeep, 'days');

  try {
    const directories = fs.readdirSync(sessionsDir);

    for (const dir of directories) {
      // YYYY-MM-DD-HHmm形式のディレクトリ名をパース
      const match = dir.match(/^(\d{4}-\d{2}-\d{2})-\d{4}$/);
      if (match) {
        const dirDate = dayjs.utc(match[1], 'YYYY-MM-DD');

        if (dirDate.isBefore(cutoffDate)) {
          const dirPath = path.join(sessionsDir, dir);
          fs.rmSync(dirPath, { recursive: true, force: true });
          // 削除完了（コンソール出力はロガーを使用すべきだが、ここではロガーがまだ読み込まれていない可能性がある）
        }
      }
    }
  } catch (error) {
    console.error('ログクリーンアップ中にエラーが発生しました:', error);
  }
}