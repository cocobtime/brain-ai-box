
import { AppConfig, Portfolio } from './types';

export const DEFAULT_CONFIG: AppConfig = {
  symbol: 'SPY',
  alpacaKey: 'PKVXZ4W6KYEJASA2TKXBWCTYR3',
  alpacaSecret: 'AMnMZ4w1ko5FAGEvQpX4HFNUnbgrsUdfpoTxiSgGGUvM',
  isSimulation: false, // Default to REAL (Paper) trading
  tradingEnabled: true, // Start with brain active
  intervalSeconds: 60, // 1 minute interval as requested
};

export const INITIAL_PORTFOLIO: Portfolio = {
  cash: 100000,
  positions: {}, 
  equity: 100000,
  initialBalance: 100000,
};

export const SYSTEM_INSTRUCTION = `
You are "TradeBrain", a hedge fund AI manager.
Your goal is to analyze a batch of potential stock opportunities and generate a list of buy/sell orders.
You will receive a list of "Scanner Results" containing current price and trend for multiple assets.
You must output a JSON object containing an array of trade decisions.
1. Analyze the trends.
2. Check the confidence. Only trade if confidence > 70.
3. Diversify. Don't put all cash into one asset.
4. If you decide to BUY, ensure quantity is reasonable (e.g., 1-10 shares depending on price).
`;
