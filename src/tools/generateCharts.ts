import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import dayjs from "dayjs";
import { config } from "../schemas/config";
import { parseDailyAverageCsv, parsePlayerDataCsv } from "../utils/csv-parser";
import { createLogger } from "../utils/logger";

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
 * @description CSVファイルの内容を読み込み
 * @param filePath - ファイルパス
 * @returns ファイル内容(存在しない場合はnull)
 */
async function readCsvContent(filePath: string): Promise<string | null> {
	try {
		return await fs.readFile(filePath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw error;
	}
}

/**
 * @description チャート出力先ディレクトリを算出
 * @returns chartsディレクトリのパス
 */
function getChartsDir(): string {
	return resolve(dirname(config.output.csvFilePath), "charts");
}

/**
 * @description プレイヤー数チャートを生成
 * @param days - 表示日数
 */
async function generatePlayerCountChart(days: number = 7): Promise<void> {
	logger.info(`Generating player count chart for last ${days} days...`);

	const content = await readCsvContent(config.output.csvFilePath);
	if (!content) {
		logger.warn("No player data available for chart generation");
		return;
	}

	const allRecords = parsePlayerDataCsv(content);
	const cutoff = dayjs().subtract(days, "day");
	const filteredData = allRecords.filter((r) =>
		dayjs(r.timestamp).isAfter(cutoff),
	);

	if (filteredData.length === 0) {
		logger.warn(`No data available for the last ${days} days`);
		return;
	}

	const labels = filteredData.map((r) =>
		dayjs(r.timestamp).format("MM/DD HH:mm"),
	);
	const data = filteredData.map((r) => r.playerCount);

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
					data,
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
				legend: {
					display: true,
					position: "top" as const,
				},
			},
			scales: {
				x: {
					display: true,
					title: { display: true, text: "Date/Time" },
				},
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
async function generateDailyAverageChart(days: number = 30): Promise<void> {
	logger.info(`Generating daily average chart for last ${days} days...`);

	const content = await readCsvContent(config.output.dailyAverageCsvFilePath);
	if (!content) {
		logger.warn("No daily average data available for chart generation");
		return;
	}

	const allRecords = parseDailyAverageCsv(content);
	const cutoff = dayjs().subtract(days, "day");
	const filteredData = allRecords.filter((r) => dayjs(r.date).isAfter(cutoff));

	if (filteredData.length === 0) {
		logger.warn(`No daily average data available for the last ${days} days`);
		return;
	}

	const labels = filteredData.map((r) => dayjs(r.date).format("MM/DD"));
	const averageData = filteredData.map((r) => r.averagePlayerCount);
	const hasExtendedData = filteredData.some(
		(r) => r.maxPlayerCount !== undefined,
	);
	const maxData = hasExtendedData
		? filteredData.map((r) => r.maxPlayerCount ?? null)
		: null;
	const minData = hasExtendedData
		? filteredData.map((r) => r.minPlayerCount ?? null)
		: null;

	const datasets = [
		{
			label: "Average Players",
			data: averageData,
			borderColor: "rgb(75, 192, 192)",
			backgroundColor: "rgba(75, 192, 192, 0.2)",
			tension: 0.1,
			fill: false,
		},
	];

	if (hasExtendedData && maxData && minData) {
		datasets.push({
			label: "Maximum Players",
			data: maxData as number[],
			borderColor: "rgb(255, 99, 132)",
			backgroundColor: "rgba(255, 99, 132, 0.2)",
			tension: 0.1,
			fill: false,
		});

		datasets.push({
			label: "Minimum Players",
			data: minData as number[],
			borderColor: "rgb(54, 162, 235)",
			backgroundColor: "rgba(54, 162, 235, 0.2)",
			tension: 0.1,
			fill: false,
		});
	}

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
				legend: {
					display: true,
					position: "top" as const,
				},
			},
			scales: {
				x: {
					display: true,
					title: { display: true, text: "Date" },
				},
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
		console.log('Charts saved in the "charts" directory');

		process.exit(0);
	} catch (error) {
		logger.error(
			`Failed to generate charts: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
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
