import { createLogger } from "./logger";

const logger = createLogger("retry");

export class RetryHandler {
	private maxRetries: number;
	private baseDelay: number;

	constructor(maxRetries: number, baseDelay: number) {
		this.maxRetries = maxRetries;
		this.baseDelay = baseDelay;
	}

	async executeWithRetry<T>(
		operation: () => Promise<T>,
		operationName: string = "operation",
	): Promise<T> {
		let lastError = new Error("No attempts made");

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				if (attempt === this.maxRetries) {
					throw new Error(
						`${operationName} failed after ${this.maxRetries + 1} attempts. Last error: ${lastError.message}`,
					);
				}

				const delay = this.calculateDelay(attempt);
				logger.warn(
					`${operationName} attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`,
				);

				await this.sleep(delay);
			}
		}

		throw lastError;
	}

	private calculateDelay(attempt: number): number {
		return Math.min(this.baseDelay * 5 ** attempt, 30000);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
