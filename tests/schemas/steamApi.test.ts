import { describe, expect, it } from "bun:test";
import {
	steamAppDetailsSchema,
	steamPlayerCountResponseSchema,
} from "../../src/schemas/steamApi";

describe("steamPlayerCountResponseSchema", () => {
	it("正常なプレイヤー数レスポンスをパースできる", () => {
		const result = steamPlayerCountResponseSchema.parse({
			response: { player_count: 12345 },
		});
		expect(result.response.player_count).toBe(12345);
	});

	it("player_count欠落でZodErrorを投げる", () => {
		expect(() =>
			steamPlayerCountResponseSchema.parse({ response: {} }),
		).toThrow();
	});

	it("player_countが非数値でZodErrorを投げる", () => {
		expect(() =>
			steamPlayerCountResponseSchema.parse({
				response: { player_count: "abc" },
			}),
		).toThrow();
	});

	it("空オブジェクトでZodErrorを投げる", () => {
		expect(() => steamPlayerCountResponseSchema.parse({})).toThrow();
	});

	it("player_count=0も正常にパースできる", () => {
		const result = steamPlayerCountResponseSchema.parse({
			response: { player_count: 0 },
		});
		expect(result.response.player_count).toBe(0);
	});
});

describe("steamAppDetailsSchema", () => {
	it("正常なアプリ詳細をパースできる", () => {
		const result = steamAppDetailsSchema.parse({
			success: true,
			data: { name: "Counter-Strike 2" },
		});
		expect(result.data.name).toBe("Counter-Strike 2");
	});

	it("success=falseでZodErrorを投げる", () => {
		expect(() =>
			steamAppDetailsSchema.parse({
				success: false,
				data: { name: "test" },
			}),
		).toThrow();
	});

	it("name欠落でZodErrorを投げる", () => {
		expect(() =>
			steamAppDetailsSchema.parse({ success: true, data: {} }),
		).toThrow();
	});
});
