
import { RAGDocument, MarketData, TradeOutcome } from '../types';

class RAGService {
  // Map of Symbol -> Document History
  private memory: Record<string, RAGDocument[]> = {};
  private tradeHistory: TradeOutcome[] = [];
  private maxHistory = 20; 

  addRecord(data: MarketData) {
    if (!this.memory[data.symbol]) {
        this.memory[data.symbol] = [];
    }
    const history = this.memory[data.symbol];

    // Calculate Volatility (Standard Deviation of last N prices including current)
    const prices = history.slice(-9).map(h => h.metadata.price);
    prices.push(data.price);
    
    let volatility = 0;
    if (prices.length > 1) {
        const mean = prices.reduce((sum, val) => sum + val, 0) / prices.length;
        const variance = prices.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / prices.length;
        volatility = Math.sqrt(variance);
    }

    const doc: RAGDocument = {
      id: crypto.randomUUID(),
      content: `Price of ${data.symbol} is ${data.price}`,
      metadata: {
        symbol: data.symbol,
        timestamp: data.timestamp,
        price: data.price,
        trend: 'FLAT',
        changePercent: data.changePercent,
        volatility: parseFloat(volatility.toFixed(4))
      }
    };
    
    // Determine Trend
    if (history.length > 0) {
        const lastPrice = history[history.length - 1].metadata.price;
        if (data.price > lastPrice) doc.metadata.trend = 'UP';
        if (data.price < lastPrice) doc.metadata.trend = 'DOWN';
    }

    history.push(doc);
    
    if (history.length > this.maxHistory) {
      history.shift();
    }
  }

  recordTradeOutcome(outcome: TradeOutcome) {
      this.tradeHistory.push(outcome);
      if (this.tradeHistory.length > 50) this.tradeHistory.shift();
  }

  getLearningContext(): string {
      if (this.tradeHistory.length === 0) return "No past trades to learn from yet.";

      const wins = this.tradeHistory.filter(t => t.profit > 0);
      const losses = this.tradeHistory.filter(t => t.profit <= 0);
      const winRate = (wins.length / this.tradeHistory.length) * 100;
      
      return `
      SELF-REFLECTION / LEARNING MEMORY:
      - Total Trades Analyzed: ${this.tradeHistory.length}
      - Win Rate: ${winRate.toFixed(1)}%
      - Recent Wins: ${wins.slice(-3).map(w => `${w.symbol} (+$${w.profit.toFixed(2)})`).join(', ') || 'None'}
      - Recent Losses: ${losses.slice(-3).map(l => `${l.symbol} ($${l.profit.toFixed(2)})`).join(', ') || 'None'}
      `;
  }

  // Get enriched context specifically for the tickers we are about to trade
  getBatchContext(symbols: string[]): string {
    let context = "MARKET INTELLIGENCE (RAG ANALYSIS):\n";

    symbols.forEach(sym => {
        const history = this.memory[sym];
        if (!history || history.length === 0) return;

        const latest = history[history.length - 1];
        const last5 = history.slice(-5);
        const pricePath = last5.map(h => h.metadata.price.toFixed(2)).join(' -> ');
        
        // Calculate average volatility over the recent window
        const avgVol = last5.reduce((sum, h) => sum + (h.metadata.volatility || 0), 0) / last5.length;

        context += `[ASSET: ${sym}]
        - Current Price: $${latest.metadata.price}
        - Price Path (Last 5): ${pricePath}
        - Volatility (Risk): ${avgVol.toFixed(4)}
        - Recent Change: ${latest.metadata.changePercent?.toFixed(2)}%
        - Trend Direction: ${latest.metadata.trend}\n`;
    });

    return context;
  }
}

export const ragService = new RAGService();
