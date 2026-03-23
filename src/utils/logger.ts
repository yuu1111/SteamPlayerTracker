import winston from "winston";
import {
	cleanOldLogs,
	SessionErrorFileTransport,
	SessionFileTransport,
} from "./sessionFileTransport";

const getLogLevel = (): string => {
	const level = process.env.LOG_LEVEL;
	if (level) return level;

	if (process.env.NODE_ENV === "development" || process.env.DEBUG === "true") {
		return "debug";
	}

	return "info";
};

const logFormat = winston.format.combine(
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	winston.format.printf((info) => {
		const { timestamp, level, message, ...metadata } = info;

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
	winston.format.timestamp({ format: "HH:mm:ss" }),
	winston.format.printf(({ timestamp, level, message, ...metadata }) => {
		const levelColorMap: Record<string, { short: string; color: string }> = {
			error: { short: "ERR", color: "\x1b[31m" },
			warn: { short: "WRN", color: "\x1b[33m" },
			info: { short: "INF", color: "\x1b[36m" },
			debug: { short: "DBG", color: "\x1b[35m" },
			verbose: { short: "VRB", color: "\x1b[34m" },
			silly: { short: "SIL", color: "\x1b[37m" },
		};

		const levelInfo = levelColorMap[level] ?? {
			short: level.substring(0, 3).toUpperCase(),
			color: "\x1b[37m",
		};
		const reset = "\x1b[0m";

		let msg = `[${timestamp} ${levelInfo.color}${levelInfo.short}${reset}] ${message}`;

		if (
			metadata &&
			typeof metadata === "object" &&
			Object.keys(metadata).length > 0
		) {
			const metadataColor = "\x1b[90m";
			msg += ` ${metadataColor}${JSON.stringify(metadata)}${reset}`;
		}
		return msg;
	}),
);

export const logger = winston.createLogger({
	level: getLogLevel(),
	format: logFormat,
	defaultMeta: { service: "steam-player-tracker" },
	transports: [
		new winston.transports.Console({
			format: consoleFormat,
		}),
		new SessionErrorFileTransport({
			maxsize: 10485760,
			maxFiles: 1,
		}),
		new SessionFileTransport({
			maxsize: 10485760,
			maxFiles: 1,
		}),
	],
});

/**
 * @description ログメンテナンス(古いログの削除)を開始
 * @returns メンテナンスを停止するdispose関数
 */
export function initLogMaintenance(): () => void {
	try {
		cleanOldLogs(7);
	} catch (error) {
		console.error("Log cleanup error:", error);
	}

	const intervalId = setInterval(
		() => {
			try {
				cleanOldLogs(7);
			} catch (error) {
				console.error("Periodic log cleanup error:", error);
			}
		},
		24 * 60 * 60 * 1000,
	);

	return () => clearInterval(intervalId);
}

/**
 * @description モジュール別の子ロガーを生成
 * @param module - モジュール名
 */
export const createLogger = (module: string): winston.Logger => {
	const currentLevel = getLogLevel();
	if (logger.level !== currentLevel) {
		logger.level = currentLevel;
	}
	return logger.child({ module });
};
