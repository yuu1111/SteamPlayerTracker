import type { CronController } from "bun";
import { getServices } from "../services/container";

/**
 * @description 前日の日次平均を計算
 */
async function calculateDailyAverage(): Promise<void> {
	const { config, logger, retryHandler, dailyAverageService } = getServices();

	if (!config.output.dailyAverageCsvEnabled || !dailyAverageService) {
		return;
	}

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
