
import { MarketData, AppConfig } from '../types';
import { TICKERS } from '../tickers';
import { alpacaService } from './alpacaService';

// Store prices per symbol for simulation continuity
const simulatedPrices: Record<string, { price: number, trend: number }> = {};
const volatility = 0.015; 

const initializePrice = (symbol: string) => {
    let startPrice = Math.random() * 200 + 10;
    if (symbol.includes('BTC')) startPrice = 65000;
    else if (symbol.includes('ETH')) startPrice = 3500;
    else if (symbol === 'SPY') startPrice = 500;
    else if (symbol === 'NVDA') startPrice = 900;
    
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
  
  if (!config.isSimulation && config.alpacaKey) {
      const realPrice = await alpacaService.getLatestQuote(config, symbol);
      if (realPrice) {
          // We don't easily get change percent from a simple quote endpoint without historicals
          // So we will assume 0 or estimate based on previous scrape for this session
          return {
              timestamp: Date.now(),
              price: realPrice,
              symbol: symbol,
              changePercent: 0 // Placeholder for real data single quote
          };
      }
  }

  // Fallback to simulation
  return stepSimulation(symbol);
};

// Scanner: Pick N random tickers and get prices
export const scanMarketBatch = async (batchSize: number = 10, config: AppConfig): Promise<MarketData[]> => {
  // Pick random tickers from the master list
  const shuffled = [...TICKERS].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, batchSize);

  // Parallel fetch
  const results = await Promise.all(selected.map(sym => fetchMarketPrice(sym, config)));
  return results;
};
