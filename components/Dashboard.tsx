
import React from 'react';
import { MarketData, Portfolio, AppConfig, LastOrder } from '../types';

interface Props {
  scannerData: MarketData[];
  portfolio: Portfolio;
  config: AppConfig;
  lastOrder: LastOrder | null;
  startEquity: number;
}

export const Dashboard: React.FC<Props> = ({ scannerData, portfolio, config, lastOrder, startEquity }) => {

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const profit = portfolio.equity - startEquity;
  const profitPercent = startEquity > 0 ? (profit / startEquity) * 100 : 0;
  const isProfitPositive = profit >= 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Centerpiece: Performance */}
      <div className="lg:col-span-1 flex flex-col gap-6">
         {/* Profit Card */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden h-[240px]">
            <h2 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest z-10 mb-2">Daily Performance</h2>
            <div className={`text-5xl font-bold font-mono z-10 ${isProfitPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isProfitPositive ? '+' : ''}{profitPercent.toFixed(3)}%
            </div>
            <div className={`text-lg font-mono z-10 mt-2 ${isProfitPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isProfitPositive ? '+' : ''}${fmt(profit)}
            </div>
            
            <div className={`absolute inset-0 opacity-10 z-0 ${isProfitPositive ? 'bg-green-500' : 'bg-red-500'}`}></div>
         </div>

         {/* Net Worth Card */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col justify-center h-[236px]">
            <h2 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest mb-2">Total Equity</h2>
            <div className="text-3xl font-bold text-white font-mono">${fmt(portfolio.equity)}</div>
            <div className="text-sm text-gray-500 mt-1">Cash: ${fmt(portfolio.cash)}</div>
            <div className="mt-4 text-xs text-gray-600 font-mono">
                CONNECTED TO: {config.isSimulation ? 'SIMULATION' : 'ALPACA PAPER'}
            </div>
         </div>
      </div>

      {/* Right Panel: Last Activity & Scanner */}
      <div className="lg:col-span-2 flex flex-col gap-6">
         
         {/* Last Order Status - THE REQUESTED FEATURE */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 h-[240px]">
             <h2 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest mb-4">Last Order Activity</h2>
             {lastOrder ? (
                 <div className="flex items-start gap-4 animate-fade-in">
                     <div className={`p-3 rounded-full ${lastOrder.status === 'FAILED' ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'}`}>
                        {lastOrder.status === 'FAILED' ? (
                             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        )}
                     </div>
                     <div>
                         <div className="text-2xl font-bold text-white flex items-center gap-2">
                             {lastOrder.action} {lastOrder.qty} {lastOrder.symbol}
                             <span className={`text-xs px-2 py-1 rounded border ${
                                 lastOrder.status === 'SENT' ? 'border-yellow-500 text-yellow-500' :
                                 lastOrder.status === 'FILLED' ? 'border-green-500 text-green-500' :
                                 'border-red-500 text-red-500'
                             }`}>
                                 {lastOrder.status}
                             </span>
                         </div>
                         <div className="text-sm text-gray-400 font-mono mt-1">
                             Time: {new Date(lastOrder.timestamp).toLocaleTimeString()}
                         </div>
                         {lastOrder.error && (
                             <div className="text-xs text-red-400 mt-2 bg-red-950/30 p-2 rounded">
                                 Error: {lastOrder.error}
                             </div>
                         )}
                         {lastOrder.price && (
                             <div className="text-sm text-gray-500 mt-1">
                                 Fill Estimate: ${fmt(lastOrder.price)}
                             </div>
                         )}
                     </div>
                 </div>
             ) : (
                 <div className="h-full flex items-center justify-center text-gray-600 font-mono text-sm italic">
                     No orders executed yet this session.
                 </div>
             )}
         </div>

         {/* Scanner Feed */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl flex-1 min-h-[236px] p-4">
             <h2 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest mb-3 flex justify-between">
                 <span>Live Market Scanner</span>
                 <span className="text-green-500 animate-pulse">● Monitoring</span>
             </h2>
             <div className="overflow-x-auto">
                <div className="flex gap-3 pb-2">
                    {scannerData.slice(0, 8).map(d => (
                        <div key={d.symbol} className="min-w-[120px] bg-gray-950 p-3 rounded border border-gray-800">
                            <div className="font-bold text-white">{d.symbol}</div>
                            <div className="text-lg font-mono text-gray-300">${d.price.toFixed(2)}</div>
                            <div className={`text-xs ${d.changePercent && d.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {d.changePercent?.toFixed(2)}%
                            </div>
                        </div>
                    ))}
                </div>
             </div>
         </div>

      </div>
    </div>
  );
};
