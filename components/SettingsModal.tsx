import React, { useState } from 'react';
import { AppConfig } from '../types';
import { TICKERS } from '../tickers';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (newConfig: AppConfig) => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, config, onSave }) => {
  const [formState, setFormState] = useState<AppConfig>(config);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormState(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="bg-gray-850 p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">System Configuration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-mono text-gray-400 mb-1">TRADING SYMBOL</label>
            <div className="relative">
              <input 
                list="ticker-list"
                type="text" 
                name="symbol"
                value={formState.symbol}
                onChange={(e) => setFormState({...formState, symbol: e.target.value.toUpperCase()})}
                placeholder="Search (e.g., AAPL, SPY)"
                className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none uppercase font-mono"
              />
              <datalist id="ticker-list">
                {TICKERS.map((ticker) => (
                  <option key={ticker} value={ticker} />
                ))}
              </datalist>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">Select from top 1000 Alpaca-tradable assets</p>
          </div>

          <div>
            <label className="block text-xs font-mono text-gray-400 mb-1">ALPACA API KEY (Optional for Sim)</label>
            <input 
              type="password" 
              name="alpacaKey"
              value={formState.alpacaKey}
              onChange={handleChange}
              className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-xs font-mono text-gray-400 mb-1">ALPACA SECRET (Optional for Sim)</label>
            <input 
              type="password" 
              name="alpacaSecret"
              value={formState.alpacaSecret}
              onChange={handleChange}
              className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center space-x-3 p-3 bg-gray-950 rounded border border-gray-800">
            <input 
              type="checkbox"
              name="isSimulation"
              checked={formState.isSimulation}
              onChange={handleChange}
              id="sim-mode"
              className="w-4 h-4 accent-blue-500"
            />
            <label htmlFor="sim-mode" className="text-sm text-gray-300 cursor-pointer select-none">
              <span className="font-bold text-white">Simulation Mode</span>
              <br/>
              <span className="text-xs text-gray-500">Use fake money & simulated data</span>
            </label>
          </div>
          
          <div className="flex items-center space-x-3 p-3 bg-gray-950 rounded border border-gray-800">
             <input 
              type="checkbox"
              name="tradingEnabled"
              checked={formState.tradingEnabled}
              onChange={handleChange}
              id="auto-trade"
              className="w-4 h-4 accent-green-500"
            />
            <label htmlFor="auto-trade" className="text-sm text-gray-300 cursor-pointer select-none">
              <span className="font-bold text-white">Enable Brain Auto-Trading</span>
              <br/>
              <span className="text-xs text-gray-500">Allow AI to place orders automatically</span>
            </label>
          </div>

        </div>

        <div className="p-4 bg-gray-850 border-t border-gray-800 flex justify-end">
          <button 
            onClick={() => {
                onSave(formState);
                onClose();
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-semibold transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
