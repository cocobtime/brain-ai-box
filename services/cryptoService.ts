
import { MarketData } from '../types';

// CoinGecko API is free and does not require a key for basic usage
const BASE_URL = 'https://api.coingecko.com/api/v3';

const ID_MAP: Record<string, string> = {
    'BTC/USD': 'bitcoin',
    'ETH/USD': 'ethereum',
    'SOL/USD': 'solana',
    'DOGE/USD': 'dogecoin',
    'DOT/USD': 'polkadot',
    'ADA/USD': 'cardano'
};

export const cryptoService = {
    getQuote: async (symbol: string): Promise<number | null> => {
        const coinId = ID_MAP[symbol];
        if (!coinId) return null;

        try {
            const res = await fetch(`${BASE_URL}/simple/price?ids=${coinId}&vs_currencies=usd`);
            if (!res.ok) return null;
            
            const data = await res.json();
            return data[coinId]?.usd || null;
        } catch (e) {
            // Silent fail, fallback to sim
            return null;
        }
    }
};
