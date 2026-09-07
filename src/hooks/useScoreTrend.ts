/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import type { GameSession, ScoreTrendPoint } from '../types';

const MAX_TREND_POINTS = 50; // 限制趨勢圖數據點數量

/**
 * 分數趨勢計算 Hook
 * 使用 useMemo 優化趨勢數據計算，限制數據點數量防止性能下降
 */
export function useScoreTrend(session: GameSession | null) {
  const scoreTrend = useMemo(() => {
    if (!session) return [{ time: '00:00', red: 0, blue: 0 }];

    if (session.status === 'waiting') {
      return [{ time: '00:00', red: 0, blue: 0 }];
    }

    if (session.status !== 'battle' && session.status !== 'finished') {
      return [{ time: '00:00', red: 0, blue: 0 }];
    }

    // 根據已用時間計算當前時間點
    const elapsedSeconds = session.duration - session.timeRemaining;
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const currentTimeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return [{ 
      time: currentTimeStr, 
      red: session.redScore, 
      blue: session.blueScore 
    }];
  }, [session?.timeRemaining, session?.status, session?.duration, session?.redScore, session?.blueScore]);

  // 獲取限制的趨勢數據（用於圖表顯示）
  const limitedTrendData = useMemo(() => {
    return scoreTrend.slice(-MAX_TREND_POINTS);
  }, [scoreTrend]);

  return {
    scoreTrend,
    limitedTrendData,
    hasEnoughData: scoreTrend.length > 1
  };
}
