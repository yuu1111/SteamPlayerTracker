/**
 * @description ログレベル
 */
type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * @description ログレベルの優先度マップ
 */
const levels: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

/**
 * @description 現在のログレベル閾値
 */
const threshold = levels[(process.env.LOG_LEVEL ?? "info") as LogLevel] ?? 1;

/**
 * @description ログエントリをstdoutにJSON出力
 * @param level - ログレベル
 * @param module - モジュール名
 * @param msg - メッセージ
 * @param meta - 追加メタデータ
 */
function log(
	level: LogLevel,
	module: string,
	msg: string,
	meta?: Record<string, unknown>,
): void {
	if ((levels[level] ?? 0) < threshold) return;

	const entry = {
		time: new Date().toISOString(),
		level,
		module,
		msg,
		...meta,
	};
	console.log(JSON.stringify(entry));
}

/**
 * @description ロガーの公開インターフェース
 */
export interface Logger {
	info(msg: string, meta?: Record<string, unknown>): void;
	warn(msg: string, meta?: Record<string, unknown>): void;
	error(msg: string, meta?: Record<string, unknown>): void;
	debug(msg: string, meta?: Record<string, unknown>): void;
}

/**
 * @description モジュール別ロガーを生成
 * @param module - モジュール名
 */
export function createLogger(module: string): Logger {
	return {
		info: (msg, meta?) => log("info", module, msg, meta),
		warn: (msg, meta?) => log("warn", module, msg, meta),
		error: (msg, meta?) => log("error", module, msg, meta),
		debug: (msg, meta?) => log("debug", module, msg, meta),
	};
}
