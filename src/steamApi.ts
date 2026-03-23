import {
	steamAppDetailsSchema,
	steamPlayerCountResponseSchema,
} from "./schemas/steamApi";

/**
 * @description Steam Web APIのベースURL
 */
const BASE_URL = "https://api.steampowered.com";

/**
 * @description Steamストアの APIベースURL
 */
const STORE_BASE_URL = "https://store.steampowered.com";

/**
 * @description Steam APIクライアントの公開インターフェース
 */
export interface SteamApiClient {
	getCurrentPlayerCount(): Promise<number>;
	getGameName(): Promise<string | null>;
}

/**
 * @description Steam APIクライアントを生成
 * @param appId - SteamアプリケーションID
 * @returns Steam API操作関数を持つオブジェクト
 */
export function createSteamApiClient(appId: number): SteamApiClient {
	/**
	 * @description Steam Web APIから現在のプレイヤー数を取得
	 * @returns 現在のプレイヤー数
	 * @throws プレイヤー数が0の場合またはAPI通信エラー
	 */
	async function getCurrentPlayerCount(): Promise<number> {
		const url = `${BASE_URL}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`;

		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(10000),
			});

			if (!response.ok) {
				throw new Error(
					`Steam API error: ${response.status} - ${response.statusText}`,
				);
			}

			const data = await response.json();
			const parsed = steamPlayerCountResponseSchema.parse(data);
			const playerCount = parsed.response.player_count;

			if (playerCount === 0) {
				throw new Error(
					"Steam API returned 0 players - treating as failed request",
				);
			}

			return playerCount;
		} catch (error) {
			if (error instanceof Error && error.name === "TimeoutError") {
				throw new Error("Steam API request timeout");
			}
			throw error;
		}
	}

	/**
	 * @description Steam Store APIからゲーム名を取得
	 * @returns ゲーム名(取得失敗時はnull)
	 */
	async function getGameName(): Promise<string | null> {
		const url = `${STORE_BASE_URL}/api/appdetails?appids=${appId}&filters=basic`;

		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(10000),
			});

			if (!response.ok) return null;

			const data = (await response.json()) as Record<string, unknown>;
			const gameData = data?.[String(appId)];
			const parsed = steamAppDetailsSchema.safeParse(gameData);
			if (parsed.success) {
				return parsed.data.data.name;
			}

			return null;
		} catch (_error) {
			return null;
		}
	}

	return { getCurrentPlayerCount, getGameName };
}
