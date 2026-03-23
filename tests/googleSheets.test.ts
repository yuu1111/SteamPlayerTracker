import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { SheetColumnDef } from "../src/googleSheets";

const mockGet = mock(() =>
	Promise.resolve({ data: { values: [["id", "value"]] } }),
);
const mockUpdate = mock(() => Promise.resolve());
const mockAppend = mock(() => Promise.resolve());
const mockClear = mock(() => Promise.resolve());
const mockBatchUpdate = mock(() => Promise.resolve());

mock.module("node:fs", () => ({
	promises: {
		readFile: mock(() =>
			Promise.resolve(
				JSON.stringify({
					client_email: "test@test.iam.gserviceaccount.com",
					private_key:
						"-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----",
				}),
			),
		),
	},
}));

mock.module("google-auth-library", () => ({
	JWT: class FakeJWT {},
}));

mock.module("googleapis", () => ({
	google: {
		sheets: () => ({
			spreadsheets: {
				values: {
					get: mockGet,
					update: mockUpdate,
					append: mockAppend,
					clear: mockClear,
				},
				batchUpdate: mockBatchUpdate,
			},
		}),
	},
}));

/**
 * @description テスト用データ型
 */
interface TestRecord {
	id: string;
	value: number;
}

/**
 * @description テスト用列定義
 */
const testColumnDef: SheetColumnDef<TestRecord> = {
	headers: ["id", "value"],
	columnRange: "A:B",
	toRow: (r) => [r.id, r.value],
	getKey: (r) => r.id,
};

const { createSheetAccessor } = await import("../src/googleSheets");

describe("createSheetAccessor", () => {
	beforeEach(() => {
		mockGet.mockReset();
		mockUpdate.mockReset();
		mockAppend.mockReset();
		mockClear.mockReset();
		mockBatchUpdate.mockReset();

		mockGet.mockResolvedValue({
			data: { values: [["id", "value"]] },
		});
		mockUpdate.mockResolvedValue({});
		mockAppend.mockResolvedValue({});
		mockClear.mockResolvedValue({});
		mockBatchUpdate.mockResolvedValue({});
	});

	describe("append", () => {
		it("ヘッダー確認後に新規行を追加する", async () => {
			mockGet
				.mockResolvedValueOnce({ data: { values: [["id", "value"]] } })
				.mockResolvedValueOnce({ data: { values: [["id"]] } });

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await accessor.append({ id: "row-1", value: 42 });

			expect(mockAppend).toHaveBeenCalledTimes(1);
		});

		it("既存キーが見つかった場合はupdateする", async () => {
			mockGet
				.mockResolvedValueOnce({ data: { values: [["id", "value"]] } })
				.mockResolvedValueOnce({
					data: { values: [["id"], ["row-1"]] },
				});

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await accessor.append({ id: "row-1", value: 99 });

			expect(mockUpdate).toHaveBeenCalledTimes(1);
			expect(mockAppend).not.toHaveBeenCalled();
		});

		it("エラー時にラップしたErrorをthrowする", async () => {
			mockGet.mockRejectedValueOnce(new Error("network error"));

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await expect(accessor.append({ id: "row-1", value: 1 })).rejects.toThrow(
				"Failed to append/update record",
			);
		});
	});

	describe("batchAppend", () => {
		it("複数レコードを一括追加する", async () => {
			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await accessor.batchAppend([
				{ id: "a", value: 1 },
				{ id: "b", value: 2 },
			]);

			expect(mockAppend).toHaveBeenCalledTimes(1);
		});

		it("空配列はno-op", async () => {
			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await accessor.batchAppend([]);

			expect(mockAppend).not.toHaveBeenCalled();
		});

		it("エラー時にラップしたErrorをthrowする", async () => {
			mockGet.mockRejectedValueOnce(new Error("fail"));

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await expect(
				accessor.batchAppend([{ id: "a", value: 1 }]),
			).rejects.toThrow("Failed to batch append");
		});
	});

	describe("replaceAll", () => {
		it("クリア後にソート済みデータを書き込む", async () => {
			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await accessor.replaceAll([
				{ id: "b", value: 2 },
				{ id: "a", value: 1 },
			]);

			expect(mockClear).toHaveBeenCalledTimes(1);
			expect(mockUpdate).toHaveBeenCalledTimes(1);
			const call = mockUpdate.mock.calls[0] as [Record<string, unknown>];
			const body = call[0].requestBody as { values: unknown[][] };
			expect(body.values[0]).toEqual(["id", "value"]);
			expect(body.values[1]).toEqual(["a", 1]);
			expect(body.values[2]).toEqual(["b", 2]);
		});

		it("空配列ではクリアのみ実行する", async () => {
			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await accessor.replaceAll([]);

			expect(mockClear).toHaveBeenCalledTimes(1);
			expect(mockUpdate).not.toHaveBeenCalled();
		});

		it("エラー時にラップしたErrorをthrowする", async () => {
			mockClear.mockRejectedValueOnce(new Error("clear fail"));

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await expect(
				accessor.replaceAll([{ id: "a", value: 1 }]),
			).rejects.toThrow("Failed to replace all");
		});
	});

	describe("ensureHeader", () => {
		it("ヘッダーが不一致の場合はupdateする", async () => {
			mockGet
				.mockResolvedValueOnce({ data: { values: [["wrong"]] } })
				.mockResolvedValueOnce({ data: { values: [["id"]] } });

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await accessor.append({ id: "row-1", value: 1 });

			const updateCalls = mockUpdate.mock.calls as [Record<string, unknown>][];
			const headerCall = updateCalls.find((c) => {
				const rb = c[0].requestBody as { values: unknown[][] } | undefined;
				return rb?.values?.[0]?.[0] === "id";
			});
			expect(headerCall).toBeDefined();
		});

		it("Unable to parse rangeエラーでシートを新規作成する", async () => {
			mockGet
				.mockRejectedValueOnce(new Error("Unable to parse range"))
				.mockResolvedValueOnce({ data: { values: [["id", "value"]] } })
				.mockResolvedValueOnce({ data: { values: [["id"]] } });

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await accessor.append({ id: "row-1", value: 1 });

			expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
		});
	});

	describe("findRowByKey", () => {
		it("Unable to parse rangeエラーでnullを返す", async () => {
			mockGet
				.mockResolvedValueOnce({ data: { values: [["id", "value"]] } })
				.mockRejectedValueOnce(new Error("Unable to parse range"));

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await accessor.append({ id: "row-1", value: 1 });

			expect(mockAppend).toHaveBeenCalledTimes(1);
		});

		it("データなしでnullを返す", async () => {
			mockGet
				.mockResolvedValueOnce({ data: { values: [["id", "value"]] } })
				.mockResolvedValueOnce({ data: { values: null } });

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await accessor.append({ id: "row-1", value: 1 });

			expect(mockAppend).toHaveBeenCalledTimes(1);
		});
	});

	describe("clearData", () => {
		it("Unable to parse rangeエラーを無視する", async () => {
			mockClear.mockRejectedValueOnce(new Error("Unable to parse range"));

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await accessor.replaceAll([{ id: "a", value: 1 }]);

			expect(mockUpdate).toHaveBeenCalledTimes(1);
		});

		it("その他のエラーはthrowする", async () => {
			mockClear.mockRejectedValueOnce(new Error("server error"));

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await expect(
				accessor.replaceAll([{ id: "a", value: 1 }]),
			).rejects.toThrow();
		});
	});

	describe("createSheet", () => {
		it("already existsエラーを無視する", async () => {
			mockGet.mockRejectedValueOnce(new Error("Unable to parse range"));
			mockBatchUpdate.mockRejectedValueOnce(new Error("already exists"));
			mockGet
				.mockResolvedValueOnce({ data: { values: [["id", "value"]] } })
				.mockResolvedValueOnce({ data: { values: [["id"]] } });

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await accessor.append({ id: "row-1", value: 1 });

			expect(mockAppend).toHaveBeenCalledTimes(1);
		});

		it("その他のcreateSheetエラーはthrowする", async () => {
			mockGet.mockRejectedValueOnce(new Error("Unable to parse range"));
			mockBatchUpdate.mockRejectedValueOnce(new Error("quota exceeded"));

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await expect(accessor.append({ id: "row-1", value: 1 })).rejects.toThrow(
				"Failed to append/update record",
			);
		});
	});

	describe("ensureHeader (その他エラー)", () => {
		it("Unable to parse range以外のensureHeaderエラーはthrowする", async () => {
			mockGet.mockRejectedValueOnce(new Error("auth failure"));

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await expect(accessor.append({ id: "row-1", value: 1 })).rejects.toThrow(
				"Failed to append/update record",
			);
		});
	});

	describe("findRowByKey (その他エラー)", () => {
		it("Unable to parse range以外のfindRowByKeyエラーはthrowする", async () => {
			mockGet
				.mockResolvedValueOnce({ data: { values: [["id", "value"]] } })
				.mockRejectedValueOnce(new Error("timeout"));

			const accessor = createSheetAccessor(
				"s1",
				"Sheet1",
				"/fake/key.json",
				testColumnDef,
			);
			await expect(accessor.append({ id: "row-1", value: 1 })).rejects.toThrow(
				"Failed to append/update record",
			);
		});
	});
});
