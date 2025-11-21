
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
  const [startOfDayEquity, setStartOfDayEquity] = useState<number>(100000); 
  
  // UI State
  const [activeScanner, setActiveScanner] = useState<MarketData[]>([]); 
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [alpacaStatus, setAlpacaStatus] = useState<'CONNECTED' | 'ERROR' | 'SIM'>('SIM');
  const [isLoading, setIsLoading] = useState(true);
  
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

  // Force switch to simulation if Alpaca fails critically
  const switchToSim = useCallback((reason: string) => {
      if (!configRef.current.isSimulation) {
          addLog('WARNING', `Switching to Simulation Mode: ${reason}`);
          setConfig(prev => ({ ...prev, isSimulation: true }));
          setAlpacaStatus('SIM');
      }
  }, [addLog]);

  // Initial Sync with Alpaca
  useEffect(() => {
      const syncAlpaca = async () => {
          if (!config.isSimulation && config.alpacaKey) {
              try {
                  const account = await alpacaService.getAccount(config);
                  const eq = parseFloat(account.equity);
                  const cash = parseFloat(account.cash);
                  
                  setStartOfDayEquity(eq); 
                  setPortfolio({
                      cash: cash,
                      equity: eq,
                      positions: {}, 
                      initialBalance: eq
                  });
                  addLog('INFO', 'Connected to Alpaca Paper Account', { equity: eq, cash });
                  setAlpacaStatus('CONNECTED');
              } catch (e: any) {
                  if (e.message === 'PERMANENT_FAILURE') {
                      switchToSim("Alpaca Proxy not detected.");
                  } else {
                      addLog('ERROR', 'Failed to connect to Alpaca', { error: e.message });
                      setAlpacaStatus('ERROR');
                  }
              }
          } else {
              setAlpacaStatus('SIM');
          }
          setIsLoading(false);
      };
      syncAlpaca();
  }, [config.alpacaKey, config.isSimulation, addLog, config, switchToSim]);

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
            if (err.message === 'PERMANENT_FAILURE') {
                switchToSim("Lost connection to Proxy during trade.");
            } else {
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
                initialBalance: parseFloat(account.equity) 
            }));
            setAlpacaStatus('CONNECTED');
        } catch(e: any) {
            if (e.message === 'PERMANENT_FAILURE') switchToSim("Proxy failed during refresh.");
            else setAlpacaStatus('ERROR');
        }
    }
  };

  const runScannerLoop = useCallback(async () => {
    const currentConfig = configRef.current;
    
    try {
        // 1. SCAN
        const scanResults = await scanMarketBatch(10, currentConfig);
        
        // Ensure we get data for owned assets
        const ownedSymbols = Object.keys(portfolioRef.current.positions);
        for (const owned of ownedSymbols) {
            if (!scanResults.find(s => s.symbol === owned)) {
                try {
                    const price = await fetchMarketPrice(owned, currentConfig);
                    scanResults.push(price);
                } catch (e: any) {
                    if (e.message === 'PERMANENT_FAILURE') throw e;
                    console.warn(`Could not fetch price for owned asset ${owned}`);
                }
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
    } catch (err: any) {
        if (err.message === 'PERMANENT_FAILURE') {
            switchToSim("Proxy connection lost during scanner loop.");
        } else {
            console.error("Critical Scanner Loop Error:", err);
            addLog('ERROR', 'Scanner Loop Crashed (Auto-Recovering)', err.message);
        }
    }
  }, [addLog, switchToSim]);

  // Main Loop
  useEffect(() => {
    if (isLoading) return; // Wait for initialization

    runScannerLoop();
    const intervalId = setInterval(() => {
      runScannerLoop();
    }, config.intervalSeconds * 1000); 

    return () => clearInterval(intervalId);
  }, [config.intervalSeconds, runScannerLoop, isLoading]);

  if (isLoading) {
      return (
          <div className="min-h-screen bg-gray-950 flex items-center justify-center flex-col">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <h2 className="text-xl font-mono text-blue-400">Initializing TradeBrain AI...</h2>
              <p className="text-gray-500 text-sm mt-2">Connecting to market feeds & neural networks</p>
          </div>
      );
  }

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
           <div className="flex items-center gap-2 mt-1">
             <span className={`px-2 py-0.5 text-[10px] rounded font-bold ${
                 alpacaStatus === 'CONNECTED' ? 'bg-green-900 text-green-300' : 
                 alpacaStatus === 'ERROR' ? 'bg-red-900 text-red-300' : 
                 'bg-blue-900 text-blue-300'
             }`}>
                 {alpacaStatus === 'CONNECTED' ? 'ALPACA ONLINE' : alpacaStatus === 'ERROR' ? 'CONNECTION ERROR' : 'SIMULATION'}
             </span>
             <p className="text-gray-500 text-sm font-mono">
               {config.isSimulation ? 'SIMULATION MODE' : 'PAPER TRADING'}
             </p>
           </div>
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