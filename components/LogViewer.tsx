import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
}

export const LogViewer: React.FC<Props> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'INFO': return 'text-gray-400';
      case 'SUCCESS': return 'text-green-400';
      case 'WARNING': return 'text-yellow-400';
      case 'ERROR': return 'text-red-400';
      case 'BRAIN': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-3 bg-gray-850 border-b border-gray-800">
        <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">System Logs & Thoughts</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
        {logs.length === 0 && <div className="text-gray-600 italic text-center mt-4">System initializing... waiting for activity.</div>}
        {logs.map((log) => (
          <div key={log.id} className="flex items-start space-x-2 animate-fade-in">
            <span className="text-gray-600 whitespace-nowrap">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
            <div className="flex-1 break-words">
               <span className={`font-bold ${getTypeColor(log.type)}`}>[{log.type}]</span> <span className="text-gray-300">{log.message}</span>
               {log.data && (
                 <pre className="mt-1 bg-gray-950 p-2 rounded text-gray-500 overflow-x-auto">
                   {JSON.stringify(log.data, null, 2)}
                 </pre>
               )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};