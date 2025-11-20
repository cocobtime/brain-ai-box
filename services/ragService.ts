
import { RAGDocument, MarketData } from '../types';

class RAGService {
  // Map of Symbol -> Document History
  private memory: Record<string, RAGDocument[]> = {};
  private maxHistory = 20; 

  addRecord(data: MarketData) {
    if (!this.memory[data.symbol]) {
        this.memory[data.symbol] = [];
    }

    const doc: RAGDocument = {
      id: crypto.randomUUID(),
      content: `Price of ${data.symbol} is ${data.price}`,
      metadata: {
        symbol: data.symbol,
        timestamp: data.timestamp,
        price: data.price,
        trend: 'FLAT'
      }
    };
    
    const history = this.memory[data.symbol];

    // Calculate trend
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

  // Get context specifically for the tickers we are about to trade
  getBatchContext(symbols: string[]): string {
    let context = "MARKET SNAPSHOTS (RAG MEMORY):\n";

    symbols.forEach(sym => {
        const history = this.memory[sym];
        if (!history || history.length === 0) return;

        const last3 = history.slice(-3);
        const historyStr = last3.map(h => `${h.metadata.price}`).join(' -> ');
        
        // Calculate volatility/range from memory
        const prices = history.map(h => h.metadata.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);

        context += `- ${sym}: Recent Path [${historyStr}]. Range: ${min}-${max}.\n`;
    });

    return context;
  }
}

export const ragService = new RAGService();
