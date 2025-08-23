import { promises as fs } from 'fs';
import { resolve } from 'path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { format, subDays } from 'date-fns';
import { createLogger } from '../utils/logger';

const logger = createLogger('generate-charts');

interface ChartConfig {
  width: number;
  height: number;
  backgroundColor: string;
}

const defaultConfig: ChartConfig = {
  width: 1600,
  height: 900,
  backgroundColor: 'white'
};

async function readCsvFile(filePath: string): Promise<string[][]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n');
    return lines.map(line => line.split(',').map(cell => cell.trim()));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function generatePlayerCountChart(days: number = 7): Promise<void> {
  logger.info(`Generating player count chart for last ${days} days...`);
  
  const csvPath = resolve(__dirname, '../../steam_concurrent_players.csv');
  const csvData = await readCsvFile(csvPath);
  
  if (csvData.length <= 1) {
    logger.warn('No player data available for chart generation');
    return;
  }
  
  // Filter data for the specified number of days
  const cutoffDate = subDays(new Date(), days);
  const filteredData = csvData.slice(1).filter(row => {
    const timestamp = new Date(row[0]);
    return timestamp >= cutoffDate;
  });
  
  if (filteredData.length === 0) {
    logger.warn(`No data available for the last ${days} days`);
    return;
  }
  
  // Prepare data for chart
  const labels = filteredData.map(row => format(new Date(row[0]), 'MM/dd HH:mm'));
  const data = filteredData.map(row => parseInt(row[1], 10));
  
  // Create chart
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
    width: defaultConfig.width, 
    height: defaultConfig.height,
    backgroundColour: defaultConfig.backgroundColor
  });
  
  const configuration = {
    type: 'line' as const,
    data: {
      labels,
      datasets: [{
        label: 'Concurrent Players',
        data,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
        fill: true
      }]
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: `Steam Concurrent Players - Last ${days} Days`,
          font: { size: 20 }
        },
        legend: {
          display: true,
          position: 'top' as const
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Date/Time'
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Player Count'
          },
          beginAtZero: false
        }
      }
    }
  };
  
  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  const outputPath = resolve(__dirname, `../../charts/player_count_${days}days.png`);
  
  // Ensure charts directory exists
  await fs.mkdir(resolve(__dirname, '../../charts'), { recursive: true });
  await fs.writeFile(outputPath, imageBuffer);
  
  logger.info(`Player count chart saved to ${outputPath}`);
}

async function generateDailyAverageChart(days: number = 30): Promise<void> {
  logger.info(`Generating daily average chart for last ${days} days...`);
  
  const csvPath = resolve(__dirname, '../../steam_daily_averages.csv');
  const csvData = await readCsvFile(csvPath);
  
  if (csvData.length <= 1) {
    logger.warn('No daily average data available for chart generation');
    return;
  }
  
  // Filter data for the specified number of days
  const cutoffDate = subDays(new Date(), days);
  const filteredData = csvData.slice(1).filter(row => {
    const date = new Date(row[0]);
    return date >= cutoffDate;
  });
  
  if (filteredData.length === 0) {
    logger.warn(`No daily average data available for the last ${days} days`);
    return;
  }
  
  // Check if extended data is available
  const hasExtendedData = csvData[0].length > 3;
  
  // Prepare data for chart
  const labels = filteredData.map(row => format(new Date(row[0]), 'MM/dd'));
  const averageData = filteredData.map(row => parseInt(row[1], 10));
  const maxData = hasExtendedData ? filteredData.map(row => row[3] ? parseInt(row[3], 10) : null) : null;
  const minData = hasExtendedData ? filteredData.map(row => row[5] ? parseInt(row[5], 10) : null) : null;
  
  const datasets = [{
    label: 'Average Players',
    data: averageData,
    borderColor: 'rgb(75, 192, 192)',
    backgroundColor: 'rgba(75, 192, 192, 0.2)',
    tension: 0.1,
    fill: false
  }];
  
  if (hasExtendedData && maxData && minData) {
    datasets.push({
      label: 'Maximum Players',
      data: maxData as (number | null)[],  // Chart.js accepts null values for missing data points
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      tension: 0.1,
      fill: false
    } as any);  // Chart.js dataset type is complex and allows null values
    
    datasets.push({
      label: 'Minimum Players',
      data: minData as (number | null)[],  // Chart.js accepts null values for missing data points
      borderColor: 'rgb(54, 162, 235)',
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      tension: 0.1,
      fill: false
    } as any);  // Chart.js dataset type is complex and allows null values
  }
  
  // Create chart
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
    width: defaultConfig.width, 
    height: defaultConfig.height,
    backgroundColour: defaultConfig.backgroundColor
  });
  
  const configuration = {
    type: 'line' as const,
    data: {
      labels,
      datasets
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: `Daily Player Statistics - Last ${days} Days`,
          font: { size: 20 }
        },
        legend: {
          display: true,
          position: 'top' as const
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Date'
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Player Count'
          },
          beginAtZero: false
        }
      }
    }
  };
  
  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  const outputPath = resolve(__dirname, `../../charts/daily_average_${days}days.png`);
  
  // Ensure charts directory exists
  await fs.mkdir(resolve(__dirname, '../../charts'), { recursive: true });
  await fs.writeFile(outputPath, imageBuffer);
  
  logger.info(`Daily average chart saved to ${outputPath}`);
}

async function generateAllCharts(): Promise<void> {
  try {
    logger.info('Starting chart generation...');
    
    // Generate player count charts for different time periods
    await generatePlayerCountChart(1);   // Last 24 hours
    await generatePlayerCountChart(7);   // Last week
    await generatePlayerCountChart(30);  // Last month
    
    // Generate daily average charts
    await generateDailyAverageChart(7);   // Last week
    await generateDailyAverageChart(30);  // Last month
    await generateDailyAverageChart(60);  // Last 2 months
    
    logger.info('All charts generated successfully');
    console.log('✅ All charts have been generated successfully!');
    console.log('📊 Charts saved in the "charts" directory');
    
    // Explicitly exit to ensure all connections are closed
    process.exit(0);
    
  } catch (error) {
    logger.error(`Failed to generate charts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('❌ Failed to generate charts:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const days = args[1] ? parseInt(args[1], 10) : undefined;

// Run if called directly
if (require.main === module) {
  switch (command) {
    case 'player-count':
      generatePlayerCountChart(days || 7).then(() => process.exit(0));
      break;
    case 'daily-average':
      generateDailyAverageChart(days || 30).then(() => process.exit(0));
      break;
    default:
      generateAllCharts();
  }
}