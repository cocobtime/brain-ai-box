
import { AppConfig, AlpacaAccount } from '../types';

const BASE_URL = 'https://paper-api.alpaca.markets/v2';
const DATA_URL = 'https://data.alpaca.markets/v2/stocks';

export const alpacaService = {
  getHeaders: (config: AppConfig) => ({
    'APCA-API-KEY-ID': config.alpacaKey,
    'APCA-API-SECRET-KEY': config.alpacaSecret,
    'Content-Type': 'application/json',
  }),

  getAccount: async (config: AppConfig): Promise<AlpacaAccount> => {
    const response = await fetch(`${BASE_URL}/account`, {
      headers: alpacaService.getHeaders(config)
    });
    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Alpaca Account Error: ${txt}`);
    }
    return response.json();
  },

  placeOrder: async (config: AppConfig, symbol: string, qty: number, side: 'buy' | 'sell') => {
    // Ensure qty is integer for Alpaca (unless using fractional, but keep simple for now)
    const intQty = Math.floor(qty);
    if (intQty <= 0) return;

    const response = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: alpacaService.getHeaders(config),
      body: JSON.stringify({
        symbol,
        qty: intQty,
        side,
        type: 'market',
        time_in_force: 'day'
      })
    });
    
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Order Failed');
    }
    return response.json();
  },
  
  getLatestQuote: async (config: AppConfig, symbol: string): Promise<number | null> => {
      try {
        // Using IEX feed which is often available on paper accounts
        const response = await fetch(`${DATA_URL}/${symbol}/quotes/latest?feed=iex`, {
            headers: alpacaService.getHeaders(config)
        });
        
        if(!response.ok) return null;
        
        const data = await response.json();
        // Return ask price or bid price or last trade price if available
        return data.quote?.ap || data.quote?.bp || null;
      } catch (e) {
          console.warn("Alpaca Quote Error", e);
          return null;
      }
  },

  getPositions: async (config: AppConfig) => {
      const response = await fetch(`${BASE_URL}/positions`, {
        headers: alpacaService.getHeaders(config)
      });
      if (!response.ok) return [];
      return response.json();
  }
}
