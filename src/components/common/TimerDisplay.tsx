/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Timer, PauseCircle, PlayCircle } from 'lucide-react';
import type { GameSession } from '../../types';
import { formatTimer } from '../../utils/firebaseUtils';

interface TimerDisplayProps {
  session: GameSession | null;
  onPause?: () => void;
  onResume?: () => void;
  disabled?: boolean;
}

/**
 * 計時器顯示組件
 * 顯示遊戲剩餘時間和控制按鈕
 */
export default function TimerDisplay({ session, onPause, onResume, disabled = false }: TimerDisplayProps) {
  if (!session) {
    return (
      <div className="text-center p-4" aria-label="載入中">
        <div className="animate-pulse h-16 bg-gray-200 rounded"></div>
      </div>
    );
  }

  const timeRemaining = session.timeRemaining;
  const isBattle = session.status === 'battle';
  const isPaused = session.status === 'paused';
  const isWaiting = session.status === 'waiting';
  const isFinished = session.status === 'finished';

  // 根據剩餘時間設定顏色
  const getTimeColor = () => {
    if (timeRemaining <= 30) return 'text-red-600 animate-pulse';
    if (timeRemaining <= 60) return 'text-yellow-600';
    return 'text-cyan-600';
  };

  return (
    <div 
      className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 shadow-lg border border-slate-700"
      role="timer"
      aria-label={`遊戲計時器，剩餘 ${formatTimer(timeRemaining)}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Timer className="w-8 h-8 text-cyan-400" aria-hidden="true" />
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">剩餘時間</p>
            <p className={`text-5xl font-mono font-bold ${getTimeColor()}`}>
              {formatTimer(timeRemaining)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {!isFinished && (
            <>
              {isBattle && onPause && (
                <button
                  onClick={onPause}
                  disabled={disabled}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  aria-label="暫停遊戲"
                >
                  <PauseCircle className="w-5 h-5" />
                  <span className="hidden sm:inline">暫停</span>
                </button>
              )}
              
              {(isPaused || isWaiting) && onResume && (
                <button
                  onClick={onResume}
                  disabled={disabled}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  aria-label={isPaused ? '恢復遊戲' : '開始遊戲'}
                >
                  <PlayCircle className="w-5 h-5" />
                  <span className="hidden sm:inline">{isPaused ? '恢復' : '開始'}</span>
                </button>
              )}
            </>
          )}
          
          <div className="text-center mt-2">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
              isBattle ? 'bg-red-900 text-red-300' :
              isPaused ? 'bg-yellow-900 text-yellow-300' :
              isFinished ? 'bg-green-900 text-green-300' :
              'bg-slate-700 text-slate-300'
            }`}>
              {isBattle ? '作戰中' :
               isPaused ? '已暫停' :
               isFinished ? '已結束' :
               '等待中'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
