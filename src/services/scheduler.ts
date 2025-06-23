import * as cron from 'node-cron';

export class Scheduler {
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  scheduleDataCollection(minutes: number[], callback: () => Promise<void>): void {
    this.stopAll();

    minutes.forEach((minute) => {
      const cronExpression = `${minute} * * * *`;
      
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression for minute ${minute}`);
      }

      const task = cron.schedule(cronExpression, async () => {
        try {
          await callback();
        } catch (error) {
          console.error(`Scheduled task error:`, error);
        }
      }, {
        scheduled: false,
      });

      this.tasks.set(`minute-${minute}`, task);
    });

    this.startAll();
  }

  startAll(): void {
    this.tasks.forEach((task) => {
      task.start();
    });
  }

  stopAll(): void {
    this.tasks.forEach((task) => {
      task.stop();
    });
    this.tasks.clear();
  }

  isRunning(): boolean {
    return this.tasks.size > 0;
  }

  getScheduledMinutes(): number[] {
    return Array.from(this.tasks.keys())
      .map(key => parseInt(key.replace('minute-', '')))
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
        console.error(`Daily task error:`, error);
      }
    }, {
      scheduled: false,
    });
    
    this.tasks.set(`daily-${hour}`, task);
    task.start();
  }
}