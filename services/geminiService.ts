
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { TradeDecision, Portfolio, TradeAction, MarketData } from '../types';
import { SYSTEM_INSTRUCTION } from '../constants';

// Define schema for a LIST of decisions
const batchDecisionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    decisions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          symbol: { type: Type.STRING },
          action: { type: Type.STRING, enum: [TradeAction.BUY, TradeAction.SELL, TradeAction.HOLD] },
          quantity: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
          confidence: { type: Type.NUMBER }
        },
        required: ["symbol", "action", "quantity", "reasoning", "confidence"]
      }
    }
  },
  required: ["decisions"]
};

export const getBrainBatchDecision = async (
  candidates: MarketData[],
  ragContext: string,
  portfolio: Portfolio
): Promise<TradeDecision[]> => {
  
  if (!process.env.API_KEY) {
    throw new Error("Gemini API Key not found.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Construct a prompt that looks at the batch
  const candidateList = candidates.map(c => 
    `SYMBOL: ${c.symbol} | PRICE: $${c.price} | CHANGE: ${c.changePercent}%`
  ).join('\n');

  const holdings = Object.entries(portfolio.positions)
    .map(([sym, qty]) => `${sym}: ${qty} shares`)
    .join(', ') || "None";

  const prompt = `
    MARKET SCANNER RESULTS (Candidates for trading):
    ${candidateList}

    RELEVANT RAG CONTEXT:
    ${ragContext}
    
    PORTFOLIO:
    Cash: $${portfolio.cash.toFixed(2)}
    Current Holdings: ${holdings}
    
    INSTRUCTIONS:
    - Review the candidates.
    - If a stock is dropping hard but RAG shows it's within range, maybe buy the dip.
    - If a stock is skyrocketing, maybe sell if we own it, or buy breakout.
    - Return a list of decisions. If no good trade for a symbol, return HOLD.
    - Ensure you don't spend more cash than available.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: batchDecisionSchema,
      }
    });

    const text = response.text;
    if (!text) return [];

    const result = JSON.parse(text) as { decisions: TradeDecision[] };
    return result.decisions;

  } catch (error) {
    console.error("Gemini Brain Error:", error);
    return [];
  }
};
