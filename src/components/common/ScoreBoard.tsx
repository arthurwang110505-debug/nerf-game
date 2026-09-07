/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Trophy, Users, Activity } from 'lucide-react';
import type { GameSession, DebriefingStats } from '../../types';

interface ScoreBoardProps {
  session: GameSession | null;
  redPlayers?: number;
  bluePlayers?: number;
}

/**
 * 計分板組件
 * 顯示雙方分數、玩家數量和遊戲統計
 */
export default function ScoreBoard({ session, redPlayers = 0, bluePlayers = 0 }: ScoreBoardProps) {
  if (!session) {
    return (
      <div className="grid grid-cols-2 gap-4" aria-label="載入中">
        <div className="animate-pulse h-32 bg-gray-200 rounded"></div>
        <div className="animate-pulse h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  const { redScore, blueScore } = session;
  const totalScore = redScore + blueScore;
  
  // 計算領先狀態
  const leader = redScore > blueScore ? 'red' : blueScore > redScore ? 'blue' : 'tie';
  
  // 計算分數百分比（用於進度條）
  const redPercentage = totalScore > 0 ? (redScore / totalScore) * 100 : 50;
  const bluePercentage = totalScore > 0 ? (blueScore / totalScore) * 100 : 50;

  return (
    <div 
      className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 shadow-lg border border-slate-700"
      role="region"
      aria-label="計分板"
    >
      {/* 分數顯示 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* 紅隊分數 */}
        <div 
          className={`relative p-4 rounded-lg transition-all ${
            leader === 'red' ? 'bg-red-900/30 ring-2 ring-red-500' : 'bg-red-900/20'
          }`}
          aria-label={`紅隊分數：${redScore}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-400 font-bold text-lg">紅隊</span>
            {leader === 'red' && <Trophy className="w-5 h-5 text-yellow-400" aria-label="領先" />}
          </div>
          <p className="text-4xl font-mono font-bold text-red-300">{redScore}</p>
          <div className="flex items-center gap-2 mt-2 text-sm text-red-400">
            <Users className="w-4 h-4" />
            <span>{redPlayers} 人</span>
          </div>
        </div>

        {/* 藍隊分數 */}
        <div 
          className={`relative p-4 rounded-lg transition-all ${
            leader === 'blue' ? 'bg-blue-900/30 ring-2 ring-blue-500' : 'bg-blue-900/20'
          }`}
          aria-label={`藍隊分數：${blueScore}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-400 font-bold text-lg">藍隊</span>
            {leader === 'blue' && <Trophy className="w-5 h-5 text-yellow-400" aria-label="領先" />}
          </div>
          <p className="text-4xl font-mono font-bold text-blue-300">{blueScore}</p>
          <div className="flex items-center gap-2 mt-2 text-sm text-blue-400">
            <Users className="w-4 h-4" />
            <span>{bluePlayers} 人</span>
          </div>
        </div>
      </div>

      {/* 分數對比進度條 */}
      <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden" role="progressbar" aria-valuenow={redPercentage} aria-valuemin={0} aria-valuemax={100}>
        <div 
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-500"
          style={{ width: `${redPercentage}%` }}
          aria-hidden="true"
        />
        <div 
          className="absolute right-0 top-0 h-full bg-gradient-to-l from-blue-600 to-blue-500 transition-all duration-500"
          style={{ width: `${bluePercentage}%` }}
          aria-hidden="true"
        />
      </div>
      
      {/* 總分顯示 */}
      <div className="flex items-center justify-center gap-2 mt-4 text-slate-400">
        <Activity className="w-4 h-4" />
        <span className="text-sm">總分：{totalScore}</span>
      </div>
    </div>
  );
}
