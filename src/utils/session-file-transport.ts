import fs from "node:fs";
import path from "node:path";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import winston from "winston";

dayjs.extend(utc);

export class SessionFileTransport extends winston.transports.File {
	protected sessionDirName: string;
	protected baseLogsDir: string;

	constructor(
		options: winston.transports.FileTransportOptions & {
			baseDir?: string;
		},
	) {
		const currentTime = dayjs.utc();
		const dirName = currentTime.format("YYYY-MM-DD-HHmm");
		const baseDir = options.baseDir ?? path.join(process.cwd(), "logs");
		const logPath = path.join(baseDir, dirName, "app.log");

		const dirPath = path.dirname(logPath);
		if (!fs.existsSync(dirPath)) {
			fs.mkdirSync(dirPath, { recursive: true });
		}

		super({
			...options,
			filename: logPath,
		});

		this.sessionDirName = dirName;
		this.baseLogsDir = baseDir;
	}
}

export class SessionErrorFileTransport extends SessionFileTransport {
	constructor(
		options?: winston.transports.FileTransportOptions & {
			baseDir?: string;
		},
	) {
		const currentTime = dayjs.utc();
		const dirName = currentTime.format("YYYY-MM-DD-HHmm");
		const baseDir = options?.baseDir ?? path.join(process.cwd(), "logs");
		const logPath = path.join(baseDir, dirName, "error.log");

		super({
			...options,
			filename: logPath,
			level: "error",
		});
	}
}

export function cleanOldLogs(daysToKeep = 7): void {
	const sessionsDir = path.join(process.cwd(), "logs");

	if (!fs.existsSync(sessionsDir)) {
		return;
	}

	const now = dayjs.utc();
	const cutoffDate = now.subtract(daysToKeep, "days");

	try {
		const directories = fs.readdirSync(sessionsDir);

		for (const dir of directories) {
			const match = dir.match(/^(\d{4}-\d{2}-\d{2})-\d{4}$/);
			if (match?.[1]) {
				const dirDate = dayjs.utc(match[1], "YYYY-MM-DD");

				if (dirDate.isBefore(cutoffDate)) {
					const dirPath = path.join(sessionsDir, dir);
					fs.rmSync(dirPath, { recursive: true, force: true });
				}
			}
		}
	} catch (error) {
		console.error("Error during log cleanup:", error);
	}
}
