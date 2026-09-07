/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { GameLog } from '../../types';

interface GameLogItemProps {
  log: GameLog;
}

/**
 * 單條遊戲日誌項組件
 */
function GameLogItem({ log }: GameLogItemProps) {
  const getTypeStyles = (type: GameLog['type']) => {
    switch (type) {
      case 'join': return 'text-green-400 bg-green-900/20';
      case 'hit': return 'text-red-400 bg-red-900/20';
      case 'scan': return 'text-yellow-400 bg-yellow-900/20';
      case 'medic': return 'text-cyan-400 bg-cyan-900/20';
      case 'supply': return 'text-blue-400 bg-blue-900/20';
      case 'system': return 'text-purple-400 bg-purple-900/20';
      default: return 'text-slate-400 bg-slate-900/20';
    }
  };

  const getTypeLabel = (type: GameLog['type']) => {
    switch (type) {
      case 'join': return '加入';
      case 'hit': return '擊中';
      case 'scan': return '掃描';
      case 'medic': return '醫療';
      case 'supply': return '補給';
      case 'system': return '系統';
      default: return type;
    }
  };

  const getFactionColor = (faction: GameLog['faction']) => {
    switch (faction) {
      case 'red': return 'text-red-400';
      case 'blue': return 'text-blue-400';
      case 'system': return 'text-purple-400';
      default: return 'text-slate-400';
    }
  };

  const timeStr = new Date(log.timestamp).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div 
      className="flex items-start gap-3 py-2 border-b border-slate-700/50 last:border-0"
      role="listitem"
    >
      <span className="text-xs text-slate-500 font-mono mt-1" aria-label={`時間：${timeStr}`}>
        {timeStr}
      </span>
      
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-bold ${getFactionColor(log.faction)}`}>
            {log.callsign}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${getTypeStyles(log.type)}`}>
            {getTypeLabel(log.type)}
          </span>
        </div>
        <p className="text-sm text-slate-300">{log.message}</p>
      </div>
    </div>
  );
}

interface GameLogListProps {
  logs: GameLog[];
  title?: string;
  maxDisplay?: number;
}

/**
 * 遊戲日誌列表組件
 * 顯示遊戲事件記錄
 */
export default function GameLogList({ logs, title = '戰役日誌', maxDisplay = 100 }: GameLogListProps) {
  const displayLogs = logs.slice(-maxDisplay);

  return (
    <div 
      className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700 flex flex-col h-full"
      role="region"
      aria-label={title}
    >
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        {title}
        <span className="text-sm font-normal text-slate-400">({logs.length}條記錄)</span>
      </h3>

      <div 
        className="flex-1 overflow-y-auto space-y-1 min-h-[200px]"
        role="list"
        aria-live="polite"
      >
        {displayLogs.length === 0 ? (
          <p className="text-slate-400 text-center py-8">暫無日誌記錄</p>
        ) : (
          displayLogs.map((log, index) => (
            <GameLogItem key={log.id || index} log={log} />
          ))
        )}
      </div>
    </div>
  );
}
