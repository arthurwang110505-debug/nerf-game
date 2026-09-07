/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import type { GameSession } from '../types';

/**
 * Firebase 錯誤處理工具函數
 * 根據錯誤代碼提供具體反饋消息
 */
export function getFirestoreErrorMessage(error: any, operation: string, path?: string): string {
  const code = error?.code;
  
  switch (code) {
    case 'permission-denied':
      return `權限不足：無法${operation} ${path || '資源'}`;
    case 'not-found':
      return `資源未找到：${path || '未知資源'}`;
    case 'already-exists':
      return `資源已存在：${path || '未知資源'}`;
    case 'resource-exhausted':
      return '資源耗盡：請稍後再試';
    case 'failed-precondition':
      return '前置條件不滿足：請檢查數據狀態';
    case 'aborted':
      return '操作中止：可能因衝突導致';
    case 'out-of-range':
      return '數據超出範圍：請檢查輸入值';
    case 'unimplemented':
      return '功能未實現';
    case 'internal':
      return '內部錯誤：請聯繫管理員';
    case 'unavailable':
      return '服務暫時不可用：請檢查網絡連接';
    case 'data-loss':
      return '數據丟失風險：請立即保存重要數據';
    case 'unauthenticated':
      return '未認證：請重新登錄';
    default:
      return `操作失敗：${error?.message || '未知錯誤'}`;
  }
}

/**
 * 會話驗證工具
 */
export function validateGameSession(session: Partial<GameSession>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (session.duration === undefined || session.duration === null) {
    errors.push('缺少遊戲時長');
  } else if (session.duration < 10) {
    errors.push('遊戲時長不能少於 10 秒');
  } else if (session.duration > 7200) {
    errors.push('遊戲時長不能超過 2 小時');
  }
  
  if (session.redScore === undefined || session.redScore === null) {
    errors.push('缺少紅隊分數');
  } else if (session.redScore < 0) {
    errors.push('紅隊分數不能為負數');
  }
  
  if (session.blueScore === undefined || session.blueScore === null) {
    errors.push('缺少藍隊分數');
  } else if (session.blueScore < 0) {
    errors.push('藍隊分數不能為負數');
  }
  
  if (!session.status) {
    errors.push('缺少遊戲狀態');
  } else if (!['waiting', 'battle', 'paused', 'finished'].includes(session.status)) {
    errors.push('無效的遊戲狀態');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 格式化計時器顯示
 */
export function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
