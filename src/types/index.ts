/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export * from './types';

/** 擴充遊戲日誌類型，添加元數據字段 */
export interface GameLogWithMetadata {
  id: string;
  timestamp: number;
  callsign: string;
  faction: import('./types').Faction;
  message: string;
  type: import('./types').GameLog['type'];
  playerUid?: string;
  metadata?: Record<string, unknown>;
}

/** 認證用戶接口 */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

/** 玩家統計數據 */
export interface PlayerStats {
  callsign: string;
  faction: import('./types').Faction;
  scans: number;
  hits: number;
  heals: number;
  supplies?: number;
}

/** 簡報統計數據 */
export interface DebriefingStats {
  redScans: number;
  blueScans: number;
  redFlagScans: number;
  blueFlagScans: number;
  redMedicScans: number;
  blueMedicScans: number;
  redCtrlSec: number;
  blueCtrlSec: number;
  mvpList: PlayerStats[];
}

/** 語音合成選項 */
export interface SpeechOptions {
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

/** Toast 通知類型 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

/** 分數趨勢數據點 */
export interface ScoreTrendPoint {
  time: string;
  red: number;
  blue: number;
}
