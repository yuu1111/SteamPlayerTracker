import axios from 'axios';
import { SteamApiResponse } from '../types/config';

export class SteamApiService {
  private baseUrl = 'https://api.steampowered.com';

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
        return response.data.response.player_count;
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
}