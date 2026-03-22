import { createLogger } from "./logger";

const logger = createLogger("retry");

/**
 * @description リトライハンドラの設定
 * @property maxRetries - 最大リトライ回数
 * @property baseDelay - 基本遅延時間(ms)
 */
interface RetryOptions {
	maxRetries: number;
	baseDelay: number;
}

/**
 * @description 指数バックオフ付きリトライハンドラを生成
 * @param options - リトライ設定
 * @returns リトライ実行関数を持つオブジェクト
 */
export function createRetryHandler(options: RetryOptions) {
	const { maxRetries, baseDelay } = options;

	/**
	 * @description リトライ間隔を計算(5倍乗数, 最大30秒)
	 * @param attempt - 現在の試行回数(0始まり)
	 * @returns 遅延時間(ms)
	 */
	function calculateDelay(attempt: number): number {
		return Math.min(baseDelay * 5 ** attempt, 30000);
	}

	/**
	 * @description 指定時間待機
	 * @param ms - 待機時間(ms)
	 */
	function sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * @description 非同期処理を指数バックオフ付きでリトライ実行
	 * @param operation - 実行する非同期処理
	 * @param operationName - ログ表示用の操作名
	 */
	async function executeWithRetry<T>(
		operation: () => Promise<T>,
		operationName: string = "operation",
	): Promise<T> {
		let lastError = new Error("No attempts made");

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				if (attempt === maxRetries) {
					throw new Error(
						`${operationName} failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`,
					);
				}

				const delay = calculateDelay(attempt);
				logger.warn(
					`${operationName} attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`,
				);

				await sleep(delay);
			}
		}

		throw lastError;
	}

	return { executeWithRetry };
}

/**
 * @description createRetryHandlerの返り値の型
 */
export type RetryHandler = ReturnType<typeof createRetryHandler>;
