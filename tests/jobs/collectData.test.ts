import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";

mock.module("../../src/retry", () => ({
	retry: async <T>(fn: () => Promise<T>) => fn(),
}));

const { fetchPlayerCount, collectData } = await import(
	"../../src/jobs/collectData"
);

describe("fetchPlayerCount", () => {
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it("正常なレスポンスからプレイヤー数を返す", async () => {
		fetchSpy.mockResolvedValue(
			new Response(JSON.stringify({ response: { player_count: 5000 } }), {
				status: 200,
			}),
		);

		const count = await fetchPlayerCount();
		expect(count).toBe(5000);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it("非okレスポンスでthrowする", async () => {
		fetchSpy.mockResolvedValue(new Response("Server Error", { status: 500 }));

		await expect(fetchPlayerCount()).rejects.toThrow("Steam API error: 500");
	});

	it("player_count=0でthrowする", async () => {
		fetchSpy.mockResolvedValue(
			new Response(JSON.stringify({ response: { player_count: 0 } }), {
				status: 200,
			}),
		);

		await expect(fetchPlayerCount()).rejects.toThrow(
			"Steam API returned 0 players",
		);
	});

	it("不正なレスポンスでZodErrorをthrowする", async () => {
		fetchSpy.mockResolvedValue(
			new Response(JSON.stringify({ invalid: "data" }), { status: 200 }),
		);

		await expect(fetchPlayerCount()).rejects.toThrow();
	});
});

describe("collectData", () => {
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it("成功時にエラーをthrowしない", async () => {
		fetchSpy.mockResolvedValue(
			new Response(JSON.stringify({ response: { player_count: 5000 } }), {
				status: 200,
			}),
		);

		await expect(collectData()).resolves.toBeUndefined();
	});

	it("失敗時もエラーをthrowしない (catchされる)", async () => {
		fetchSpy.mockResolvedValue(new Response("error", { status: 500 }));

		await expect(collectData()).resolves.toBeUndefined();
	});
});
