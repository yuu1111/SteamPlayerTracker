import { describe, expect, it } from "bun:test";
import { googleServiceAccountSchema } from "../../src/schemas/googleCredentials";

describe("googleServiceAccountSchema", () => {
	it("正常な認証情報をパースできる", () => {
		const result = googleServiceAccountSchema.parse({
			client_email: "test@project.iam.gserviceaccount.com",
			private_key:
				"-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
		});
		expect(result.client_email).toBe("test@project.iam.gserviceaccount.com");
	});

	it("client_emailが無効でZodErrorを投げる", () => {
		expect(() =>
			googleServiceAccountSchema.parse({
				client_email: "not-an-email",
				private_key: "key",
			}),
		).toThrow();
	});

	it("private_keyが空文字でZodErrorを投げる", () => {
		expect(() =>
			googleServiceAccountSchema.parse({
				client_email: "a@b.com",
				private_key: "",
			}),
		).toThrow();
	});

	it("フィールド欠落でZodErrorを投げる", () => {
		expect(() => googleServiceAccountSchema.parse({})).toThrow();
	});
});
