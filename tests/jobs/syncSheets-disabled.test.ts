import { describe, expect, it } from "bun:test";
import { mockConfigModule } from "../mocks/config";

mockConfigModule("../../src/config", false);

const { createSheetAccessors } = await import("../../src/jobs/syncSheets");

describe("syncSheets (Google Sheets無効)", () => {
	it("createSheetAccessorsがエラーをthrowする", () => {
		expect(() => createSheetAccessors()).toThrow(
			"Google Sheets is not enabled",
		);
	});
});
