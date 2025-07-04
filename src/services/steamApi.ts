import axios from 'axios';
import { SteamApiResponse } from '../types/config';

export class SteamApiService {
  private baseUrl = 'https://api.steampowered.com';
  private storeBaseUrl = 'https://store.steampowered.com';

  async getCurrentPlayerCount(appId: number): Promise<number> {
    const url = `${this.baseUrl}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/`;
    
    try {
      const response = await axios.get<SteamApiResponse>(url, {
        params: {
          appid: appId,
        },
        timeout: 10000,
      });

      if (response.data?.response?.player_count !== undefined) {
        const playerCount = response.data.response.player_count;
        
        // Treat 0 players as a failed request
        if (playerCount === 0) {
          throw new Error('Steam API returned 0 players - treating as failed request');
        }
        
        return playerCount;
      } else {
        throw new Error('Invalid response format from Steam API');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`Steam API error: ${error.response.status} - ${error.response.statusText}`);
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('Steam API request timeout');
        } else {
          throw new Error(`Network error: ${error.message}`);
        }
      }
      throw error;
    }
  }

  async getGameName(appId: number): Promise<string | null> {
    const url = `${this.storeBaseUrl}/api/appdetails`;
    
    try {
      const response = await axios.get(url, {
        params: {
          appids: appId,
          filters: 'basic',
        },
        timeout: 10000,
      });

      const gameData = response.data?.[appId];
      if (gameData?.success && gameData?.data?.name) {
        return gameData.data.name;
      }
      
      return null;
    } catch (error) {
      // ゲーム名取得失敗は致命的ではないため、nullを返す
      return null;
    }
  }
}