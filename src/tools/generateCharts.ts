import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import dayjs from "dayjs";
import { config } from "../config";
import { createDatabase } from "../db";
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
 */
async function generatePlayerCountChart(days = 7): Promise<void> {
	logger.info(`Generating player count chart for last ${days} days...`);

	const db = createDatabase(config.storage.dbPath);
	const from = dayjs().subtract(days, "day").format("YYYY-MM-DD 00:00:00");
	const to = dayjs().format("YYYY-MM-DD 23:59:59");
	const data = db.getPlayerDataByDateRange(from, to);
	db.close();

	if (data.length === 0) {
		logger.warn(`No data available for the last ${days} days`);
		return;
	}

	const labels = data.map((r) => dayjs(r.timestamp).format("MM/DD HH:mm"));
	const values = data.map((r) => r.playerCount);

	const chartJSNodeCanvas = new ChartJSNodeCanvas({
		width: defaultConfig.width,
		height: defaultConfig.height,
		backgroundColour: defaultConfig.backgroundColor,
	});

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

	const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
	const chartsDir = getChartsDir();
	const outputPath = resolve(chartsDir, `player_count_${days}days.png`);

	await fs.mkdir(chartsDir, { recursive: true });
	await fs.writeFile(outputPath, imageBuffer);
	logger.info(`Player count chart saved to ${outputPath}`);
}

/**
 * @description 日次平均チャートを生成
 * @param days - 表示日数
 */
async function generateDailyAverageChart(days = 30): Promise<void> {
	logger.info(`Generating daily average chart for last ${days} days...`);

	const db = createDatabase(config.storage.dbPath);
	const from = dayjs().subtract(days, "day").format("YYYY-MM-DD");
	const to = dayjs().format("YYYY-MM-DD");
	const data = db.getDailyAverageRange(from, to);
	db.close();

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

	const chartJSNodeCanvas = new ChartJSNodeCanvas({
		width: defaultConfig.width,
		height: defaultConfig.height,
		backgroundColour: defaultConfig.backgroundColor,
	});

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

	const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
	const chartsDir = getChartsDir();
	const outputPath = resolve(chartsDir, `daily_average_${days}days.png`);

	await fs.mkdir(chartsDir, { recursive: true });
	await fs.writeFile(outputPath, imageBuffer);
	logger.info(`Daily average chart saved to ${outputPath}`);
}

/**
 * @description 全チャートを生成
 */
async function generateAllCharts(): Promise<void> {
	try {
		logger.info("Starting chart generation...");

		await generatePlayerCountChart(1);
		await generatePlayerCountChart(7);
		await generatePlayerCountChart(30);

		await generateDailyAverageChart(7);
		await generateDailyAverageChart(30);
		await generateDailyAverageChart(60);

		logger.info("All charts generated successfully");
		console.log("All charts have been generated successfully!");

		process.exit(0);
	} catch (error) {
		logger.error("Failed to generate charts", {
			error: error instanceof Error ? error.message : String(error),
		});
		console.error("Failed to generate charts:", error);
		process.exit(1);
	}
}

const args = process.argv.slice(2);
const command = args[0];
const days = args[1] ? Number.parseInt(args[1], 10) : undefined;

switch (command) {
	case "player-count":
		generatePlayerCountChart(days || 7).then(() => process.exit(0));
		break;
	case "daily-average":
		generateDailyAverageChart(days || 30).then(() => process.exit(0));
		break;
	default:
		generateAllCharts();
}
