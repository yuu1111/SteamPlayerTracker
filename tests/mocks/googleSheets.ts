import { mock } from "bun:test";

/**
 * @description Google Sheets APIモックのセットアップと管理
 */
export function setupGoogleSheetsMocks() {
	const mockGet = mock(() =>
		Promise.resolve({ data: { values: [["id", "value"]] } }),
	);
	const mockUpdate = mock(() => Promise.resolve(undefined));
	const mockAppend = mock(() => Promise.resolve(undefined));
	const mockClear = mock(() => Promise.resolve(undefined));
	const mockBatchUpdate = mock(() => Promise.resolve(undefined));

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
	 * @description 全モックをリセットしデフォルトレスポンスを再設定
	 */
	function resetAll() {
		mockGet.mockReset();
		mockUpdate.mockReset();
		mockAppend.mockReset();
		mockClear.mockReset();
		mockBatchUpdate.mockReset();

		mockGet.mockResolvedValue({
			data: { values: [["id", "value"]] },
		});
		mockUpdate.mockResolvedValue(undefined);
		mockAppend.mockResolvedValue(undefined);
		mockClear.mockResolvedValue(undefined);
		mockBatchUpdate.mockResolvedValue(undefined);
	}

	return {
		mockGet,
		mockUpdate,
		mockAppend,
		mockClear,
		mockBatchUpdate,
		resetAll,
	};
}
