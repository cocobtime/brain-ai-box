
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_CONFIG, INITIAL_PORTFOLIO } from './constants';
import { AppConfig, MarketData, Portfolio, TradeDecision, LogEntry, TradeAction, LastOrder } from './types';
import { fetchMarketPrice, scanMarketBatch } from './services/marketService';
import { alpacaService } from './services/alpacaService';
import { ragService } from './services/ragService';
import { getBrainBatchDecision } from './services/geminiService';
import { Dashboard } from './components/Dashboard';
import { LogViewer } from './components/LogViewer';
import { SettingsModal } from './components/SettingsModal';

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [portfolio, setPortfolio] = useState<Portfolio>(INITIAL_PORTFOLIO);
  const [startOfDayEquity, setStartOfDayEquity] = useState<number>(100000); // Defaults, will update from Alpaca
  
  // UI State
  const [activeScanner, setActiveScanner] = useState<MarketData[]>([]); 
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  
  const configRef = useRef(config);
  const portfolioRef = useRef(portfolio);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { portfolioRef.current = portfolio; }, [portfolio]);

  const addLog = useCallback((type: LogEntry['type'], message: string, data?: any) => {
    setLogs(prev => [...prev, {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type,
      message,
      data
    }]);
  }, []);

  // Initial Sync with Alpaca
  useEffect(() => {
      const syncAlpaca = async () => {
          if (!config.isSimulation && config.alpacaKey) {
              try {
                  const account = await alpacaService.getAccount(config);
                  const eq = parseFloat(account.equity);
                  const cash = parseFloat(account.cash);
                  
                  setStartOfDayEquity(eq); // Assume start of session is reference point for "Day"
                  setPortfolio({
                      cash: cash,
                      equity: eq,
                      positions: {}, // We could fetch positions too, but keep simple for now
                      initialBalance: eq
                  });
                  addLog('INFO', 'Connected to Alpaca Paper Account', { equity: eq, cash });
              } catch (e: any) {
                  addLog('ERROR', 'Failed to connect to Alpaca', { error: e.message });
              }
          }
      };
      syncAlpaca();
  }, [config.alpacaKey, config.isSimulation, addLog, config]);

  const executeBatchTrades = async (decisions: TradeDecision[]) => {
    const currentConfig = configRef.current;
    const currentPortfolio = { ...portfolioRef.current };
    const currentPrices = Object.fromEntries(activeScanner.map(d => [d.symbol, d.price]));

    for (const d of decisions) {
        const price = currentPrices[d.symbol];
        
        try {
            if (d.action === TradeAction.BUY && d.quantity > 0) {
                if (!currentConfig.isSimulation) {
                    // REAL TRADE
                    await alpacaService.placeOrder(currentConfig, d.symbol, d.quantity, 'buy');
                    setLastOrder({
                        id: crypto.randomUUID(),
                        symbol: d.symbol,
                        action: TradeAction.BUY,
                        qty: d.quantity,
                        status: 'SENT',
                        timestamp: Date.now()
                    });
                    addLog('SUCCESS', `SENT ALPACA BUY: ${d.quantity} ${d.symbol}`);
                } else {
                    // SIMULATION
                    const cost = d.quantity * (price || 0);
                    if (cost <= currentPortfolio.cash) {
                        currentPortfolio.cash -= cost;
                        currentPortfolio.positions[d.symbol] = (currentPortfolio.positions[d.symbol] || 0) + d.quantity;
                        addLog('SUCCESS', `SIM BUY ${d.quantity} ${d.symbol} @ $${price}`);
                         setLastOrder({
                            id: crypto.randomUUID(),
                            symbol: d.symbol,
                            action: TradeAction.BUY,
                            qty: d.quantity,
                            price: price,
                            status: 'FILLED',
                            timestamp: Date.now()
                        });
                    }
                }
            } 
            else if (d.action === TradeAction.SELL && d.quantity > 0) {
                 if (!currentConfig.isSimulation) {
                    // REAL TRADE
                    await alpacaService.placeOrder(currentConfig, d.symbol, d.quantity, 'sell');
                    setLastOrder({
                        id: crypto.randomUUID(),
                        symbol: d.symbol,
                        action: TradeAction.SELL,
                        qty: d.quantity,
                        status: 'SENT',
                        timestamp: Date.now()
                    });
                    addLog('SUCCESS', `SENT ALPACA SELL: ${d.quantity} ${d.symbol}`);
                } else {
                    // SIMULATION
                    const currentQty = currentPortfolio.positions[d.symbol] || 0;
                    if (currentQty >= d.quantity) {
                        const revenue = d.quantity * (price || 0);
                        currentPortfolio.cash += revenue;
                        currentPortfolio.positions[d.symbol] -= d.quantity;
                        if (currentPortfolio.positions[d.symbol] === 0) delete currentPortfolio.positions[d.symbol];
                        addLog('SUCCESS', `SIM SOLD ${d.quantity} ${d.symbol} @ $${price}`);
                         setLastOrder({
                            id: crypto.randomUUID(),
                            symbol: d.symbol,
                            action: TradeAction.SELL,
                            qty: d.quantity,
                            price: price,
                            status: 'FILLED',
                            timestamp: Date.now()
                        });
                    }
                }
            }
        } catch (err: any) {
            addLog('ERROR', `Trade Execution Failed for ${d.symbol}`, err.message);
            setLastOrder({
                id: crypto.randomUUID(),
                symbol: d.symbol,
                action: d.action,
                qty: d.quantity,
                status: 'FAILED',
                error: err.message,
                timestamp: Date.now()
            });
        }
    }

    // Update Portfolio State
    if (currentConfig.isSimulation) {
        // Recalculate Total Equity for Sim
        let holdingsVal = 0;
        Object.keys(currentPortfolio.positions).forEach(sym => {
           const price = currentPrices[sym] || 0; 
           holdingsVal += (currentPortfolio.positions[sym] * (price > 0 ? price : 0)); 
        });
        currentPortfolio.equity = currentPortfolio.cash + holdingsVal;
        setPortfolio(currentPortfolio);
    } else {
        // Refresh Real Account
        try {
            const account = await alpacaService.getAccount(currentConfig);
            setPortfolio(prev => ({
                ...prev,
                equity: parseFloat(account.equity),
                cash: parseFloat(account.cash),
                initialBalance: parseFloat(account.equity) // Simplified logic
            }));
        } catch(e) {}
    }
  };

  const runScannerLoop = useCallback(async () => {
    const currentConfig = configRef.current;
    
    // 1. SCAN
    const scanResults = await scanMarketBatch(10, currentConfig);
    
    // Ensure we get data for owned assets
    const ownedSymbols = Object.keys(portfolioRef.current.positions);
    for (const owned of ownedSymbols) {
        if (!scanResults.find(s => s.symbol === owned)) {
             const price = await fetchMarketPrice(owned, currentConfig);
             scanResults.push(price);
        }
    }
    setActiveScanner(scanResults);

    // 2. MEMORIZE
    scanResults.forEach(data => ragService.addRecord(data));

    // 3. BRAIN
    if (currentConfig.tradingEnabled) {
        const candidates = scanResults.filter(d => 
            Math.abs(d.changePercent || 0) > 0.05 || 
            portfolioRef.current.positions[d.symbol]
        );

        if (candidates.length > 0) {
            const symbols = candidates.map(c => c.symbol);
            const ragContext = ragService.getBatchContext(symbols);
            
            addLog('BRAIN', `AI Analyzing ${candidates.length} assets...`);
            
            const decisions = await getBrainBatchDecision(candidates, ragContext, portfolioRef.current);
            const validTrades = decisions.filter(d => d.action !== TradeAction.HOLD);
            
            if (validTrades.length > 0) {
                await executeBatchTrades(validTrades);
            } 
        }
    }
  }, [addLog]);

  // Main Loop
  useEffect(() => {
    runScannerLoop();

    const intervalId = setInterval(() => {
      runScannerLoop();
    }, config.intervalSeconds * 1000); 

    return () => clearInterval(intervalId);
  }, [config.intervalSeconds, runScannerLoop]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 font-sans selection:bg-blue-500 selection:text-white">
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-6">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
             <div className="relative flex h-3 w-3">
               <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.tradingEnabled ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
               <span className={`relative inline-flex rounded-full h-3 w-3 ${config.tradingEnabled ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
             </div>
             TRADEBRAIN AI
           </h1>
           <p className="text-gray-500 text-sm mt-1 font-mono">
             {config.isSimulation ? 'SIMULATION MODE' : 'REAL ALPACA PAPER TRADING'}
           </p>
        </div>
        
        <button 
            onClick={() => setIsSettingsOpen(true)}
            className="bg-gray-900 hover:bg-gray-800 p-2 rounded border border-gray-700 text-gray-400"
        >
            Settings
        </button>
      </header>

      <Dashboard 
        scannerData={activeScanner} 
        portfolio={portfolio} 
        config={config}
        lastOrder={lastOrder}
        startEquity={startOfDayEquity}
      />

      <div className="h-[300px] mt-6">
        <LogViewer logs={logs} />
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        config={config}
        onSave={setConfig}
      />
    </div>
  );
};

export default App;
