
export enum TradeAction {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD'
}

export interface MarketData {
  timestamp: number;
  price: number;
  symbol: string;
  changePercent?: number; 
}

export interface Portfolio {
  cash: number;
  positions: Record<string, number>; 
  equity: number;
  initialBalance: number;
}

export interface TradeDecision {
  symbol: string; 
  action: TradeAction;
  quantity: number;
  reasoning: string;
  confidence: number; 
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'BRAIN' | 'SCANNER';
  message: string;
  data?: any;
}

export interface RAGDocument {
  id: string;
  content: string;
  metadata: {
    symbol: string; 
    timestamp: number;
    price: number;
    trend: 'UP' | 'DOWN' | 'FLAT';
  };
}

export interface AppConfig {
  symbol: string; 
  alpacaKey: string;
  alpacaSecret: string;
  isSimulation: boolean;
  tradingEnabled: boolean;
  intervalSeconds: number;
}

export interface LastOrder {
  id: string;
  symbol: string;
  action: TradeAction;
  qty: number;
  price?: number;
  timestamp: number;
  status: 'SENT' | 'FILLED' | 'FAILED';
  error?: string;
}

export interface AlpacaAccount {
  equity: string;
  cash: string;
  buying_power: string;
  currency: string;
}
