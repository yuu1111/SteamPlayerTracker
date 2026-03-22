import axios from "axios";
import {
	steamAppDetailsSchema,
	steamPlayerCountResponseSchema,
} from "../schemas/steam-api";

/**
 * @description Steam Web APIのベースURL
 */
const BASE_URL = "https://api.steampowered.com";

/**
 * @description Steamストアの APIベースURL
 */
const STORE_BASE_URL = "https://store.steampowered.com";

/**
 * @description Steam Web APIから現在のプレイヤー数を取得
 * @param appId - SteamアプリケーションID
 * @returns 現在のプレイヤー数
 * @throws プレイヤー数が0の場合またはAPI通信エラー
 */
export async function getCurrentPlayerCount(appId: number): Promise<number> {
	const url = `${BASE_URL}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/`;

	try {
		const response = await axios.get(url, {
			params: { appid: appId },
			timeout: 10000,
		});

		const parsed = steamPlayerCountResponseSchema.parse(response.data);
		const playerCount = parsed.response.player_count;

		if (playerCount === 0) {
			throw new Error(
				"Steam API returned 0 players - treating as failed request",
			);
		}

		return playerCount;
	} catch (error) {
		if (axios.isAxiosError(error)) {
			if (error.response) {
				throw new Error(
					`Steam API error: ${error.response.status} - ${error.response.statusText}`,
				);
			}
			if (error.code === "ECONNABORTED") {
				throw new Error("Steam API request timeout");
			}
			throw new Error(`Network error: ${error.message}`);
		}
		throw error;
	}
}

/**
 * @description Steam Store APIからゲーム名を取得
 * @param appId - SteamアプリケーションID
 * @returns ゲーム名(取得失敗時はnull)
 */
export async function getGameName(appId: number): Promise<string | null> {
	const url = `${STORE_BASE_URL}/api/appdetails`;

	try {
		const response = await axios.get(url, {
			params: { appids: appId, filters: "basic" },
			timeout: 10000,
		});

		const gameData = response.data?.[appId];
		const parsed = steamAppDetailsSchema.safeParse(gameData);
		if (parsed.success) {
			return parsed.data.data.name;
		}

		return null;
	} catch (_error) {
		return null;
	}
}
