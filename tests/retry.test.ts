import { describe, expect, it, mock } from "bun:test";
import { retry } from "../src/retry";

describe("retry", () => {
	it("初回成功で即返却する", async () => {
		const fn = mock(() => Promise.resolve(42));
		const result = await retry(fn, { baseDelay: 1 });
		expect(result).toBe(42);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("失敗→成功でリトライする", async () => {
		let callCount = 0;
		const fn = mock(() => {
			callCount++;
			if (callCount === 1) return Promise.reject(new Error("fail"));
			return Promise.resolve("ok");
		});

		const result = await retry(fn, { baseDelay: 1 });
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("全失敗で最後のエラーをthrowする", async () => {
		let callCount = 0;
		const fn = mock(() => {
			callCount++;
			return Promise.reject(new Error(`attempt-${callCount}`));
		});

		await expect(retry(fn, { attempts: 3, baseDelay: 1 })).rejects.toThrow(
			"attempt-3",
		);
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it("デフォルトで4回試行する", async () => {
		const fn = mock(() => Promise.reject(new Error("fail")));

		await expect(retry(fn, { baseDelay: 1 })).rejects.toThrow();
		expect(fn).toHaveBeenCalledTimes(4);
	});

	it("カスタム試行回数を適用する", async () => {
		const fn = mock(() => Promise.reject(new Error("fail")));

		await expect(retry(fn, { attempts: 2, baseDelay: 1 })).rejects.toThrow();
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("3回目で成功する", async () => {
		let callCount = 0;
		const fn = mock(() => {
			callCount++;
			if (callCount < 3) return Promise.reject(new Error("fail"));
			return Promise.resolve("success");
		});

		const result = await retry(fn, { attempts: 4, baseDelay: 1 });
		expect(result).toBe("success");
		expect(fn).toHaveBeenCalledTimes(3);
	});
});
