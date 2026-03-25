import { createLogger } from "./logger";

const logger = createLogger("retry");

/**
 * @description 指数バックオフ付きリトライ
 * @param fn - 実行する非同期処理
 * @param attempts - 最大試行回数 @default 4
 * @param baseDelay - 基本遅延(ms) @default 1000
 */
export async function retry<T>(
	fn: () => Promise<T>,
	{ attempts = 4, baseDelay = 1000 } = {},
): Promise<T> {
	for (let i = 0; i < attempts; i++) {
		try {
			return await fn();
		} catch (error) {
			if (i === attempts - 1) throw error;
			const delay = Math.min(baseDelay * 5 ** i, 30000);
			logger.warn(
				`Attempt ${i + 1}/${attempts} failed: ${error instanceof Error ? error.message : error}. Retrying in ${delay}ms...`,
			);
			await new Promise((r) => setTimeout(r, delay));
		}
	}
	throw new Error("unreachable");
}
