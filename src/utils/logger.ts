import winston from 'winston';
import {
  cleanOldLogs,
  SessionErrorFileTransport,
  SessionFileTransport,
} from './session-file-transport';

// ログレベルを動的に取得する関数
const getLogLevel = (): string => {
  // 環境変数が設定されていればそれを使用、なければ'info'
  // 開発環境では'debug'をデフォルトにする
  const level = process.env.LOG_LEVEL;
  if (level) return level;

  // NODE_ENVがdevelopmentまたはDEBUGがtrueの場合はdebugレベル
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
    return 'debug';
  }

  return 'info';
};

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...metadata } = info;

    // エラーの場合はメッセージを設定
    if (info.error instanceof Error) {
      (metadata as Record<string, unknown>).error = info.error.message;
    }

    return JSON.stringify({
      timestamp,
      level,
      message,
      ...metadata,
    });
  }),
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    // ログレベルを3文字の短縮形に変換し色付け
    const levelColorMap: Record<string, { short: string; color: string }> = {
      error: { short: 'ERR', color: '\x1b[31m' }, // 赤
      warn: { short: 'WRN', color: '\x1b[33m' }, // 黄
      info: { short: 'INF', color: '\x1b[36m' }, // シアン
      debug: { short: 'DBG', color: '\x1b[35m' }, // マゼンタ
      verbose: { short: 'VRB', color: '\x1b[34m' }, // 青
      silly: { short: 'SIL', color: '\x1b[37m' }, // 白
    };

    const levelInfo = levelColorMap[level] ?? {
      short: level.substring(0, 3).toUpperCase(),
      color: '\x1b[37m',
    };
    const reset = '\x1b[0m';

    let msg = `[${timestamp} ${levelInfo.color}${levelInfo.short}${reset}] ${message}`;

    if (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0) {
      const metadataColor = '\x1b[90m'; // グレー
      msg += ` ${metadataColor}${JSON.stringify(metadata)}${reset}`;
    }
    return msg;
  }),
);

export const logger = winston.createLogger({
  level: getLogLevel(), // 動的にログレベルを取得
  format: logFormat,
  defaultMeta: { service: 'steam-player-tracker' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // セッション固定ディレクトリにエラーログを保存
    new SessionErrorFileTransport({
      maxsize: 10485760, // 10MB
      maxFiles: 1, // 同一ディレクトリ内では1ファイルのみ
    }),
    // セッション固定ディレクトリに全ログを保存
    new SessionFileTransport({
      maxsize: 10485760, // 10MB
      maxFiles: 1, // 同一ディレクトリ内では1ファイルのみ
    }),
  ],
});

// アプリケーション起動時に古いログをクリーンアップ
// 7日以上古いログディレクトリを削除
try {
  cleanOldLogs(7);
} catch (error) {
  console.error('ログクリーンアップエラー:', error);
}

// 毎日24時間ごとに古いログをクリーンアップ
setInterval(
  () => {
    try {
      cleanOldLogs(7);
    } catch (error) {
      console.error('定期ログクリーンアップエラー:', error);
    }
  },
  24 * 60 * 60 * 1000,
); // 24時間

// Create a child logger for specific modules
export const createLogger = (module: string): winston.Logger => {
  // 実行時にログレベルを更新（環境変数が変更された場合に対応）
  const currentLevel = getLogLevel();
  if (logger.level !== currentLevel) {
    logger.level = currentLevel;
  }
  return logger.child({ module });
};