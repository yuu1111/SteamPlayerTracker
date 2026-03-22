import * as cron from "node-cron";

export class Scheduler {
	private tasks: Map<string, cron.ScheduledTask> = new Map();

	scheduleDataCollection(
		minutes: number[],
		callback: () => Promise<void>,
	): void {
		this.stopDataCollectionTasks();

		for (const minute of minutes) {
			const cronExpression = `${minute} * * * *`;

			if (!cron.validate(cronExpression)) {
				throw new Error(`Invalid cron expression for minute ${minute}`);
			}

			const task = cron.schedule(cronExpression, async () => {
				try {
					await callback();
				} catch (error) {
					console.error("Scheduled task error:", error);
				}
			});

			task.stop();
			this.tasks.set(`minute-${minute}`, task);
		}

		this.startAll();
	}

	startAll(): void {
		for (const task of this.tasks.values()) {
			task.start();
		}
	}

	stopDataCollectionTasks(): void {
		for (const [key, task] of this.tasks) {
			if (key.startsWith("minute-")) {
				task.stop();
				this.tasks.delete(key);
			}
		}
	}

	stopAll(): void {
		for (const task of this.tasks.values()) {
			task.stop();
		}
		this.tasks.clear();
	}

	isRunning(): boolean {
		return this.tasks.size > 0;
	}

	getScheduledMinutes(): number[] {
		return Array.from(this.tasks.keys())
			.map((key) => Number.parseInt(key.replace("minute-", ""), 10))
			.sort((a, b) => a - b);
	}

	scheduleDailyTask(hour: number, callback: () => Promise<void>): void {
		const cronExpression = `0 ${hour} * * *`;

		if (!cron.validate(cronExpression)) {
			throw new Error(`Invalid cron expression for hour ${hour}`);
		}

		const task = cron.schedule(cronExpression, async () => {
			try {
				await callback();
			} catch (error) {
				console.error("Daily task error:", error);
			}
		});

		this.tasks.set(`daily-${hour}`, task);
	}
}
