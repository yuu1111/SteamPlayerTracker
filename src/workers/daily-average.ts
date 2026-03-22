import type { CronController } from "bun";
import { config } from "../config/config";
import { DailyAverageService } from "../services/dailyAverageService";
import { createLogger } from "../utils/logger";
import { RetryHandler } from "../utils/retry";

const logger = createLogger("daily-average");

async function calculateDailyAverage(): Promise<void> {
	if (!config.output.dailyAverageCsvEnabled) {
		return;
	}

	const retryHandler = new RetryHandler(
		config.retry.maxRetries,
		config.retry.baseDelay,
	);

	const dailyAverageService = new DailyAverageService(
		config.output.csvFilePath,
		config.output.dailyAverageCsvFilePath,
		logger,
	);

	try {
		logger.info("Starting daily average calculation...");

		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);

		await retryHandler.executeWithRetry(
			() => dailyAverageService.calculateAndSaveDailyAverage(yesterday),
			"Daily average calculation",
		);

		logger.info("Daily average calculation completed successfully");
	} catch (error) {
		logger.error("Daily average calculation failed", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export default {
	async scheduled(_controller: CronController) {
		await calculateDailyAverage();
	},
};
