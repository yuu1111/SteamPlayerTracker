import type { CronController } from "bun";
import { config } from "../config";
import { createDatabase } from "../db";
import { createLogger } from "../logger";

const logger = createLogger("daily-average");
const db = createDatabase(config.storage.dbPath);

/**
 * @description 欠落している日次平均を計算しバックフィル
 */
export async function calculateAndSaveDailyAverages(): Promise<void> {
	try {
		const missingDates = db.getDatesWithDataButNoAverage();

		if (missingDates.length === 0) {
			logger.info("All daily averages are up to date");
			return;
		}

		logger.info(`Calculating daily averages for ${missingDates.length} dates`);

		for (const date of missingDates) {
			const result = db.calculateDailyAverage(date);
			if (result) {
				db.upsertDailyAverage(result);
				logger.info(`Daily average calculated for ${date}`, {
					average: result.averagePlayerCount,
					samples: result.sampleCount,
				});
			}
		}

		logger.info(
			`Daily average calculation completed for ${missingDates.length} dates`,
		);
	} catch (error) {
		logger.error("Daily average calculation failed", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export default {
	async scheduled(_controller: CronController) {
		await calculateAndSaveDailyAverages();
	},
};
