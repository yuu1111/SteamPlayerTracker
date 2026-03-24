import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import dayjs from "dayjs";
import { config } from "../config";
import { createDatabase, type Database } from "../db";
import { createLogger } from "../logger";

const logger = createLogger("generate-charts");

/**
 * @description チャート描画の共通設定
 * @property width - 画像幅
 * @property height - 画像高さ
 * @property backgroundColor - 背景色
 */
interface ChartConfig {
	width: number;
	height: number;
	backgroundColor: string;
}

/**
 * @description デフォルトのチャート設定
 */
const defaultConfig: ChartConfig = {
	width: 1600,
	height: 900,
	backgroundColor: "white",
};

/**
 * @description チャート出力先ディレクトリを算出
 */
function getChartsDir(): string {
	return resolve(dirname(config.storage.dbPath), "charts");
}

/**
 * @description プレイヤー数チャートを生成
 * @param days - 表示日数
 * @param db - データベース接続
 * @param canvas - ChartJSNodeCanvasインスタンス
 */
async function generatePlayerCountChart(
	days: number,
	db: Database,
	canvas: ChartJSNodeCanvas,
): Promise<void> {
	logger.info(`Generating player count chart for last ${days} days...`);

	const from = dayjs().subtract(days, "day").format("YYYY-MM-DD 00:00:00");
	const to = dayjs().format("YYYY-MM-DD 23:59:59");
	const data = db.getPlayerDataByDateRange(from, to);

	if (data.length === 0) {
		logger.warn(`No data available for the last ${days} days`);
		return;
	}

	const labels = data.map((r) => dayjs(r.timestamp).format("MM/DD HH:mm"));
	const values = data.map((r) => r.playerCount);

	const configuration = {
		type: "line" as const,
		data: {
			labels,
			datasets: [
				{
					label: "Concurrent Players",
					data: values,
					borderColor: "rgb(75, 192, 192)",
					backgroundColor: "rgba(75, 192, 192, 0.2)",
					tension: 0.1,
					fill: true,
				},
			],
		},
		options: {
			responsive: false,
			plugins: {
				title: {
					display: true,
					text: `Steam Concurrent Players - Last ${days} Days`,
					font: { size: 20 },
				},
				legend: { display: true, position: "top" as const },
			},
			scales: {
				x: { display: true, title: { display: true, text: "Date/Time" } },
				y: {
					display: true,
					title: { display: true, text: "Player Count" },
					beginAtZero: false,
				},
			},
		},
	};

	const imageBuffer = await canvas.renderToBuffer(configuration);
	const outputPath = resolve(getChartsDir(), `player_count_${days}days.png`);
	await fs.writeFile(outputPath, imageBuffer);
	logger.info(`Player count chart saved to ${outputPath}`);
}

/**
 * @description 日次平均チャートを生成
 * @param days - 表示日数
 * @param db - データベース接続
 * @param canvas - ChartJSNodeCanvasインスタンス
 */
async function generateDailyAverageChart(
	days: number,
	db: Database,
	canvas: ChartJSNodeCanvas,
): Promise<void> {
	logger.info(`Generating daily average chart for last ${days} days...`);

	const from = dayjs().subtract(days, "day").format("YYYY-MM-DD");
	const to = dayjs().format("YYYY-MM-DD");
	const data = db.getDailyAverageRange(from, to);

	if (data.length === 0) {
		logger.warn(`No daily average data available for the last ${days} days`);
		return;
	}

	const labels = data.map((r) => dayjs(r.date).format("MM/DD"));
	const averageData = data.map((r) => r.averagePlayerCount);
	const maxData = data.map((r) => r.maxPlayerCount);
	const minData = data.map((r) => r.minPlayerCount);

	const datasets = [
		{
			label: "Average Players",
			data: averageData,
			borderColor: "rgb(75, 192, 192)",
			backgroundColor: "rgba(75, 192, 192, 0.2)",
			tension: 0.1,
			fill: false,
		},
		{
			label: "Maximum Players",
			data: maxData,
			borderColor: "rgb(255, 99, 132)",
			backgroundColor: "rgba(255, 99, 132, 0.2)",
			tension: 0.1,
			fill: false,
		},
		{
			label: "Minimum Players",
			data: minData,
			borderColor: "rgb(54, 162, 235)",
			backgroundColor: "rgba(54, 162, 235, 0.2)",
			tension: 0.1,
			fill: false,
		},
	];

	const configuration = {
		type: "line" as const,
		data: { labels, datasets },
		options: {
			responsive: false,
			plugins: {
				title: {
					display: true,
					text: `Daily Player Statistics - Last ${days} Days`,
					font: { size: 20 },
				},
				legend: { display: true, position: "top" as const },
			},
			scales: {
				x: { display: true, title: { display: true, text: "Date" } },
				y: {
					display: true,
					title: { display: true, text: "Player Count" },
					beginAtZero: false,
				},
			},
		},
	};

	const imageBuffer = await canvas.renderToBuffer(configuration);
	const outputPath = resolve(getChartsDir(), `daily_average_${days}days.png`);
	await fs.writeFile(outputPath, imageBuffer);
	logger.info(`Daily average chart saved to ${outputPath}`);
}

/**
 * @description DB接続とCanvasを共有して全チャートを生成
 */
async function generateAllCharts(): Promise<void> {
	using db = createDatabase(config.storage.dbPath);
	const canvas = new ChartJSNodeCanvas({
		width: defaultConfig.width,
		height: defaultConfig.height,
		backgroundColour: defaultConfig.backgroundColor,
	});

	try {
		logger.info("Starting chart generation...");
		await fs.mkdir(getChartsDir(), { recursive: true });

		await generatePlayerCountChart(1, db, canvas);
		await generatePlayerCountChart(7, db, canvas);
		await generatePlayerCountChart(30, db, canvas);

		await generateDailyAverageChart(7, db, canvas);
		await generateDailyAverageChart(30, db, canvas);
		await generateDailyAverageChart(60, db, canvas);

		logger.info("All charts generated successfully");
		process.exit(0);
	} catch (error) {
		logger.error("Failed to generate charts", {
			error: error instanceof Error ? error.message : String(error),
		});
		process.exit(1);
	}
}

/**
 * @description 単一チャートCLI用のDB接続とCanvas生成
 */
async function runSingleChart(
	fn: (days: number, db: Database, canvas: ChartJSNodeCanvas) => Promise<void>,
	days: number,
): Promise<void> {
	using db = createDatabase(config.storage.dbPath);
	const canvas = new ChartJSNodeCanvas({
		width: defaultConfig.width,
		height: defaultConfig.height,
		backgroundColour: defaultConfig.backgroundColor,
	});
	await fs.mkdir(getChartsDir(), { recursive: true });
	await fn(days, db, canvas);
	process.exit(0);
}

const args = process.argv.slice(2);
const command = args[0];
const days = args[1] ? Number.parseInt(args[1], 10) : undefined;

switch (command) {
	case "player-count":
		await runSingleChart(generatePlayerCountChart, days || 7);
		break;
	case "daily-average":
		await runSingleChart(generateDailyAverageChart, days || 30);
		break;
	default:
		await generateAllCharts();
}
