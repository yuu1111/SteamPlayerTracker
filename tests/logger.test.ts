import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { createLogger } from "../src/logger";

describe("createLogger", () => {
	let consoleSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		consoleSpy = spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	it("infoレベルでJSON出力する", () => {
		const logger = createLogger("test-module");
		logger.info("test message", { key: "value" });

		expect(consoleSpy).toHaveBeenCalledTimes(1);
		const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
		expect(output.level).toBe("info");
		expect(output.module).toBe("test-module");
		expect(output.msg).toBe("test message");
		expect(output.key).toBe("value");
	});

	it("warnレベルで出力する", () => {
		const logger = createLogger("test");
		logger.warn("warning");

		const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
		expect(output.level).toBe("warn");
	});

	it("errorレベルで出力する", () => {
		const logger = createLogger("test");
		logger.error("error", { code: 500 });

		const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
		expect(output.level).toBe("error");
		expect(output.code).toBe(500);
	});

	it("デフォルトinfo閾値でdebugを抑制する", () => {
		const logger = createLogger("test");
		logger.debug("debug msg");

		expect(consoleSpy).not.toHaveBeenCalled();
	});

	it("ISO形式のタイムスタンプを含む", () => {
		const logger = createLogger("test");
		logger.info("test");

		const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
		expect(output.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
	});

	it("モジュール名が出力に含まれる", () => {
		const logger = createLogger("my-module");
		logger.info("x");

		const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
		expect(output.module).toBe("my-module");
	});
});
