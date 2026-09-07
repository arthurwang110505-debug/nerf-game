/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import type { GameLog, PlayerState, DebriefingStats, PlayerStats } from '../types';

/**
 * 遊戲統計計算 Hook
 * 使用 useMemo 優化日誌排序和統計計算
 */
export function useGameStats(logs: GameLog[], players: PlayerState[], sessionDuration?: number) {
  
  // 排序後的日誌（按時間戳升序）
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => a.timestamp - b.timestamp);
  }, [logs]);

  // 計算簡報統計數據
  const debriefingStats = useMemo((): DebriefingStats => {
    // 1. 總掃描次數
    const redScans = logs.filter(l => 
      l.faction === 'red' && (l.type === 'scan' || l.type === 'medic' || l.type === 'supply')
    ).length;
    
    const blueScans = logs.filter(l => 
      l.faction === 'blue' && (l.type === 'scan' || l.type === 'medic' || l.type === 'supply')
    ).length;

    // 子類別統計
    const redFlagScans = logs.filter(l => l.faction === 'red' && l.type === 'scan').length;
    const blueFlagScans = logs.filter(l => l.faction === 'blue' && l.type === 'scan').length;
    const redMedicScans = logs.filter(l => l.faction === 'red' && l.type === 'medic').length;
    const blueMedicScans = logs.filter(l => l.faction === 'blue' && l.type === 'medic').length;

    // 2. 控制時間計算
    const battleStartLog = logs.find(l => l.message.includes('倒數計時正式展開'));
    const battleStartTs = battleStartLog ? battleStartLog.timestamp : (logs[0]?.timestamp || Date.now());
    const finishedLog = logs.find(l => l.message.includes('戰役結束'));
    const battleEndTs = finishedLog ? finishedLog.timestamp : Date.now();

    let redTimeMs = 0;
    let blueTimeMs = 0;
    let currentController: 'red' | 'blue' | null = null;
    let currentControllerStartTime = battleStartTs;

    const controlLogs = logs.filter(
      l => l.timestamp >= battleStartTs && l.timestamp <= battleEndTs && l.type === 'scan'
    );

    for (const log of controlLogs) {
      const nextController = log.faction as 'red' | 'blue';
      if (currentController) {
        const span = log.timestamp - currentControllerStartTime;
        if (currentController === 'red') redTimeMs += span;
        else if (currentController === 'blue') blueTimeMs += span;
      }
      currentController = nextController;
      currentControllerStartTime = log.timestamp;
    }

    if (currentController) {
      const span = Math.max(0, battleEndTs - currentControllerStartTime);
      if (currentController === 'red') redTimeMs += span;
      else if (currentController === 'blue') blueTimeMs += span;
    }

    let redCtrlSec = Math.floor(redTimeMs / 1000);
    let blueCtrlSec = Math.floor(blueTimeMs / 1000);
    const totalDuration = sessionDuration || 360;

    // 標準化控制時間
    if (redCtrlSec + blueCtrlSec > totalDuration) {
      const ratio = totalDuration / (redCtrlSec + blueCtrlSec);
      redCtrlSec = Math.floor(redCtrlSec * ratio);
      blueCtrlSec = Math.floor(blueCtrlSec * ratio);
    }

    // 3. MVP 排行榜統計
    const playerStatsMap = new Map<string, PlayerStats>();
    
    players.forEach(p => {
      playerStatsMap.set(p.callsign, {
        callsign: p.callsign,
        faction: p.faction,
        scans: 0,
        hits: 0,
        heals: 0
      });
    });

    logs.forEach(log => {
      if (!log.callsign) return;
      
      if (!playerStatsMap.has(log.callsign)) {
        playerStatsMap.set(log.callsign, {
          callsign: log.callsign,
          faction: log.faction as 'red' | 'blue' || 'red',
          scans: 0,
          hits: 0,
          heals: 0
        });
      }
      
      const stats = playerStatsMap.get(log.callsign)!;
      if (log.type === 'scan') stats.scans += 1;
      else if (log.type === 'hit') stats.hits += 1;
      else if (log.type === 'medic') stats.heals += 1;
    });

    const sortedPlayers = Array.from(playerStatsMap.values())
      .sort((a, b) => b.scans - a.scans || b.heals - a.heals);

    return {
      redScans,
      blueScans,
      redFlagScans,
      blueFlagScans,
      redMedicScans,
      blueMedicScans,
      redCtrlSec,
      blueCtrlSec,
      mvpList: sortedPlayers.slice(0, 3)
    };
  }, [logs, players, sessionDuration]);

  // 活躍玩家數量
  const activePlayerCount = useMemo(() => {
    return players.filter(p => p.status === 'active').length;
  }, [players]);

  // 各陣營玩家數量
  const factionCounts = useMemo(() => {
    return {
      red: players.filter(p => p.faction === 'red').length,
      blue: players.filter(p => p.faction === 'blue').length
    };
  }, [players]);

  return {
    sortedLogs,
    debriefingStats,
    activePlayerCount,
    factionCounts
  };
}
