/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { PlayerState } from '../../types';

interface PlayerListProps {
  players: PlayerState[];
  highlightedPlayer?: string | null;
}

/**
 * 玩家列表組件
 * 顯示所有在線玩家及其狀態
 */
export default function PlayerList({ players, highlightedPlayer = null }: PlayerListProps) {
  const getStatusColor = (status: PlayerState['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'dead': return 'bg-red-500';
      case 'respawning': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: PlayerState['status']) => {
    switch (status) {
      case 'active': return '活躍';
      case 'dead': return '陣亡';
      case 'respawning': return '復活中';
      default: return '未知';
    }
  };

  const getFactionBadge = (faction: PlayerState['faction']) => {
    return faction === 'red' 
      ? 'bg-red-900/50 text-red-300 border-red-700' 
      : 'bg-blue-900/50 text-blue-300 border-blue-700';
  };

  // 按陣營和狀態排序玩家
  const sortedPlayers = [...players].sort((a, b) => {
    // 先按陣營排序
    if (a.faction !== b.faction) return a.faction === 'red' ? -1 : 1;
    // 再按狀態排序（活躍 > 復活中 > 陣亡）
    const statusOrder = { active: 0, respawning: 1, dead: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <div 
      className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700"
      role="region"
      aria-label={`玩家列表，共 ${players.length} 人`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>玩家列表</span>
          <span className="text-sm font-normal text-slate-400">({players.length}人)</span>
        </h3>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto" role="list">
        {sortedPlayers.length === 0 ? (
          <p className="text-slate-400 text-center py-8">暫無玩家</p>
        ) : (
          sortedPlayers.map(player => (
            <div
              key={player.uid}
              className={`
                flex items-center justify-between p-3 rounded-lg border transition-all
                ${highlightedPlayer === player.callsign 
                  ? 'bg-yellow-900/30 border-yellow-500 animate-pulse' 
                  : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700'}
              `}
              role="listitem"
              aria-label={`${player.callsign}，${getStatusText(player.status)}`}
            >
              <div className="flex items-center gap-3">
                {/* 狀態指示器 */}
                <div 
                  className={`w-3 h-3 rounded-full ${getStatusColor(player.status)}`}
                  aria-hidden="true"
                  title={getStatusText(player.status)}
                />
                
                {/* 玩家信息 */}
                <div>
                  <p className="font-medium text-white">{player.callsign}</p>
                  <p className="text-xs text-slate-400">
                    {getStatusText(player.status)}
                    {player.respawnTimer > 0 && ` (${player.respawnTimer}s)`}
                  </p>
                </div>
              </div>

              {/* 陣營徽章 */}
              <span className={`px-2 py-1 rounded text-xs font-medium border ${getFactionBadge(player.faction)}`}>
                {player.faction === 'red' ? '紅隊' : '藍隊'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
