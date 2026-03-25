import { describe, expect, it } from "bun:test";
import {
	parseDailyAverageCsv,
	parsePlayerDataCsv,
} from "../../src/tools/importCsv";

describe("parsePlayerDataCsv", () => {
	it("ヘッダー付きCSVをパースする", () => {
		const csv = `timestamp,player_count
2024-01-01 12:00:00,5000
2024-01-01 12:30:00,5100`;
		const result = parsePlayerDataCsv(csv);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			timestamp: "2024-01-01 12:00:00",
			playerCount: 5000,
		});
	});

	it("ヘッダー行をスキップする", () => {
		const csv = "timestamp,player_count\n2024-01-01 00:00:00,100";
		const result = parsePlayerDataCsv(csv);
		expect(result).toHaveLength(1);
	});

	it("空行をスキップする", () => {
		const csv = `timestamp,player_count
2024-01-01 00:00:00,100

2024-01-01 01:00:00,200
`;
		const result = parsePlayerDataCsv(csv);
		expect(result).toHaveLength(2);
	});

	it("不正なplayer_countの行をスキップする", () => {
		const csv = `timestamp,player_count
2024-01-01 00:00:00,100
2024-01-01 01:00:00,abc
2024-01-01 02:00:00,200`;
		const result = parsePlayerDataCsv(csv);
		expect(result).toHaveLength(2);
	});

	it("データがないCSVで空配列を返す", () => {
		const csv = "timestamp,player_count";
		expect(parsePlayerDataCsv(csv)).toEqual([]);
	});
});

describe("parseDailyAverageCsv", () => {
	it("7列形式をパースする", () => {
		const csv = `date,average_player_count,sample_count,max_player_count,max_timestamp,min_player_count,min_timestamp
2024-01-01,1100,3,1200,2024-01-01 02:00:00,1000,2024-01-01 00:00:00`;
		const result = parseDailyAverageCsv(csv);
		expect(result).toHaveLength(1);
		expect(result[0]?.date).toBe("2024-01-01");
		expect(result[0]?.maxPlayerCount).toBe(1200);
		expect(result[0]?.minTimestamp).toBe("2024-01-01 00:00:00");
	});

	it("3列形式(旧フォーマット)をパースする", () => {
		const csv = `date,average_player_count,sample_count
2024-01-01,1100,3`;
		const result = parseDailyAverageCsv(csv);
		expect(result).toHaveLength(1);
		expect(result[0]?.maxPlayerCount).toBe(1100);
		expect(result[0]?.minPlayerCount).toBe(1100);
		expect(result[0]?.maxTimestamp).toBe("2024-01-01 00:00:00");
	});

	it("dateで始まるヘッダーをスキップする", () => {
		const csv = `date,average_player_count,sample_count
2024-01-01,500,10`;
		expect(parseDailyAverageCsv(csv)).toHaveLength(1);
	});

	it("不正な数値の行をスキップする", () => {
		const csv = `date,average_player_count,sample_count
2024-01-01,abc,3
2024-01-02,500,10`;
		expect(parseDailyAverageCsv(csv)).toHaveLength(1);
	});

	it("7列形式でmax/min値が不正な場合は3列形式にフォールバックする", () => {
		const csv =
			"date,avg,samples,max,max_ts,min,min_ts\n2024-01-01,500,10,abc,,def,";
		const result = parseDailyAverageCsv(csv);
		expect(result).toHaveLength(1);
		expect(result[0]?.maxPlayerCount).toBe(500);
		expect(result[0]?.minPlayerCount).toBe(500);
	});
});
