
import { MarketData, AppConfig } from '../types';
import { TICKERS } from '../tickers';
import { alpacaService } from './alpacaService';
import { cryptoService } from './cryptoService';

// Store prices per symbol for simulation continuity
const simulatedPrices: Record<string, { price: number, trend: number }> = {};
const volatility = 0.015; 

const initializePrice = (symbol: string) => {
    // Try to give a realistic starting price instead of pure random to avoid UI jarring
    let startPrice = 100; // Default
    
    // Simple heuristics for common tickers
    if (symbol.includes('BTC')) startPrice = 67000;
    else if (symbol.includes('ETH')) startPrice = 3600;
    else if (symbol.includes('SOL')) startPrice = 150;
    else if (symbol === 'SPY') startPrice = 510;
    else if (symbol === 'NVDA') startPrice = 920;
    else if (symbol === 'AAPL') startPrice = 175;
    else if (symbol === 'MSFT') startPrice = 420;
    else if (symbol === 'TSLA') startPrice = 180;
    else {
        // Randomize slightly for others
        startPrice = Math.random() * 100 + 50;
    }
    
    simulatedPrices[symbol] = {
        price: startPrice,
        trend: Math.random() > 0.5 ? 1 : -1
    };
};

const stepSimulation = (symbol: string): MarketData => {
  if (!simulatedPrices[symbol]) initializePrice(symbol);

  const state = simulatedPrices[symbol];
  const prevPrice = state.price;

  // Random Walk
  const change = (Math.random() - 0.5 + (state.trend * 0.05)) * state.price * volatility;
  state.price += change;

  // Trend Reversal chance
  if (Math.random() > 0.9) state.trend *= -1;
  if (state.price < 1) state.price = 1;

  simulatedPrices[symbol] = state;

  const percentChange = ((state.price - prevPrice) / prevPrice) * 100;

  return {
    timestamp: Date.now(),
    price: parseFloat(state.price.toFixed(2)),
    symbol: symbol,
    changePercent: parseFloat(percentChange.toFixed(4))
  };
};

// Unified Fetcher: Uses Alpaca if configured/real, else Simulation
export const fetchMarketPrice = async (symbol: string, config: AppConfig): Promise<MarketData> => {
  
  // 1. CRYPTO (Free, Real)
  if (symbol.includes('/') || symbol === 'BTC' || symbol === 'ETH') {
      // Try CoinGecko first (Free, Real Data)
      const cryptoPrice = await cryptoService.getQuote(symbol);
      if (cryptoPrice) {
          return {
              timestamp: Date.now(),
              price: cryptoPrice,
              symbol: symbol,
              changePercent: (Math.random() - 0.5) // CoinGecko simple endpoint doesn't give change % easily without more calls
          };
      }
  }

  // 2. STOCKS (Alpaca, Real)
  if (!config.isSimulation && config.alpacaKey && !symbol.includes('/')) {
      try {
          const realPrice = await alpacaService.getLatestQuote(config, symbol);
          if (realPrice) {
              return {
                  timestamp: Date.now(),
                  price: realPrice,
                  symbol: symbol,
                  changePercent: 0 // Placeholder for real data single quote
              };
          }
      } catch (e: any) {
          if (e.message === 'PERMANENT_FAILURE') throw e;
          // Fallback to sim if just a transient error
      }
  }

  // 3. FALLBACK (Simulation)
  return stepSimulation(symbol);
};

// Scanner: Pick N random tickers and get prices
export const scanMarketBatch = async (batchSize: number = 10, config: AppConfig): Promise<MarketData[]> => {
  // Pick random tickers from the master list
  const shuffled = [...TICKERS].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, batchSize);

  // Resilient fetch: If one fails, it doesn't kill the batch, we just ignore it or fallback
  const results = await Promise.all(
    selected.map(async (sym) => {
        try {
            return await fetchMarketPrice(sym, config);
        } catch (e: any) {
            if (e.message === 'PERMANENT_FAILURE') throw e; // Propagate critical failure
            console.warn(`Failed to fetch ${sym}`, e);
            return stepSimulation(sym); // Worst case fallback
        }
    })
  );
  
  return results;
};