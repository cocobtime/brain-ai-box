
import { AppConfig, AlpacaAccount } from '../types';

// Circuit breaker state
let consecutiveErrors = 0;
const ERROR_THRESHOLD = 3; // Stop logging after 3 errors
const BACKOFF_TIME = 60000; // 60 seconds
let circuitOpenUntil = 0;

// Helper for timeouts
const fetchWithTimeout = async (resource: string, options: RequestInit & { timeout?: number } = {}) => {
  const { timeout = 8000 } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal  
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Generic request helper that handles Proxy routing and Circuit Breaking
const alpacaRequest = async (config: AppConfig, path: string, method: string = 'GET', body?: any) => {
  // 1. Check Circuit Breaker
  if (Date.now() < circuitOpenUntil) {
    throw new Error('Circuit Breaker Open: Skipping Alpaca API calls temporarily.');
  }

  const headers = {
    'APCA-API-KEY-ID': config.alpacaKey,
    'APCA-API-SECRET-KEY': config.alpacaSecret,
    'Content-Type': 'application/json',
  };

  try {
    // 2. Try sending via Vercel Proxy first (solves CORS)
    const proxyPayload = {
      targetPath: path,
      method,
      headers,
      body
    };

    // Note: relative path '/api/alpaca' works for Vercel deployments
    const response = await fetchWithTimeout('/api/alpaca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proxyPayload),
      timeout: 8000
    });

    const contentType = response.headers.get('content-type');
    
    // If we got HTML (like a 404 page from React Router or Vercel missing func), treat as Proxy Not Found
    if (contentType && contentType.includes('text/html')) {
       throw new Error('PROXY_NOT_FOUND');
    }

    if (response.status === 404) {
       // Double check if it's the proxy missing or the Alpaca endpoint missing
       // Usually if /api/alpaca returns 404 it means the function isn't deployed
       const text = await response.text();
       if (text.includes('NOT_FOUND')) throw new Error('PROXY_NOT_FOUND');
    }

    if (!response.ok) {
       const text = await response.text();
       let errMessage = 'Alpaca API Error via Proxy';
       try {
           const json = JSON.parse(text);
           errMessage = json.message || json.error || errMessage;
       } catch (e) {
           errMessage = text.substring(0, 100);
       }
       throw new Error(errMessage);
    }

    // Success
    consecutiveErrors = 0;
    return response.json();

  } catch (error: any) {
    // 3. Critical Failure Logic
    if (error.message === 'PROXY_NOT_FOUND' || error.message.includes('Failed to fetch')) {
        // This usually means the backend isn't running.
        // We throw a specific error so App.tsx can switch to Simulation Mode.
        console.warn("Alpaca Proxy unavailable. Switching to simulation.");
        throw new Error('PERMANENT_FAILURE');
    }

    handleError(error);
    throw error;
  }
};

// Helper to manage error counting and logging
const handleError = (error: any) => {
    consecutiveErrors++;
    if (consecutiveErrors >= ERROR_THRESHOLD) {
        if (consecutiveErrors === ERROR_THRESHOLD) {
            console.error(`Alpaca Connection Unstable. Pausing requests for ${BACKOFF_TIME/1000}s.`);
        }
        circuitOpenUntil = Date.now() + BACKOFF_TIME;
    } else {
        // Only log the first few errors to avoid spam
        console.warn("Alpaca Service Warning:", error.message);
    }
};

export const alpacaService = {
  getAccount: async (config: AppConfig): Promise<AlpacaAccount> => {
    return alpacaRequest(config, '/v2/account');
  },

  placeOrder: async (config: AppConfig, symbol: string, qty: number, side: 'buy' | 'sell') => {
    const intQty = Math.floor(qty);
    if (intQty <= 0) return;

    console.log(`Sending Order: ${side.toUpperCase()} ${intQty} ${symbol}`);
    
    return alpacaRequest(config, '/v2/orders', 'POST', {
        symbol,
        qty: intQty,
        side,
        type: 'market',
        time_in_force: 'day'
    });
  },
  
  getLatestQuote: async (config: AppConfig, symbol: string): Promise<number | null> => {
      try {
        // Data API
        const path = `/v2/stocks/${symbol}/quotes/latest?feed=iex`;
        const data = await alpacaRequest(config, path);
        return data.quote?.ap || data.quote?.bp || null;
      } catch (e: any) {
          // If PERMANENT_FAILURE (Proxy missing), we re-throw so App.tsx knows to kill connection
          if (e.message === 'PERMANENT_FAILURE') throw e;
          
          // Otherwise silent fail for quotes to keep scanner running smoothly
          return null;
      }
  },

  getPositions: async (config: AppConfig) => {
      try {
        return await alpacaRequest(config, '/v2/positions');
      } catch (e: any) {
        if (e.message === 'PERMANENT_FAILURE') throw e;
        return [];
      }
  }
}
