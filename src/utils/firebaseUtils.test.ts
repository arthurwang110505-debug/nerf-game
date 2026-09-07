/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { formatTimer, validateGameSession, getFirestoreErrorMessage } from '../firebaseUtils';

describe('firebaseUtils', () => {
  describe('formatTimer', () => {
    it('應該正確格式化秒數為 MM:SS 格式', () => {
      expect(formatTimer(0)).toBe('00:00');
      expect(formatTimer(5)).toBe('00:05');
      expect(formatTimer(60)).toBe('01:00');
      expect(formatTimer(125)).toBe('02:05');
      expect(formatTimer(3661)).toBe('61:01');
    });

    it('應該處理邊界值', () => {
      expect(formatTimer(9)).toBe('00:09');
      expect(formatTimer(10)).toBe('00:10');
      expect(formatTimer(59)).toBe('00:59');
    });
  });

  describe('validateGameSession', () => {
    it('應該驗證有效的遊戲會話', () => {
      const validSession = {
        duration: 360,
        redScore: 10,
        blueScore: 5,
        status: 'battle' as const
      };
      
      const result = validateGameSession(validSession);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('應該檢測缺少必填字段', () => {
      const invalidSession = {};
      
      const result = validateGameSession(invalidSession);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('應該檢測無效的遊戲時長', () => {
      const tooShort = { duration: 5, redScore: 0, blueScore: 0, status: 'waiting' as const };
      const result1 = validateGameSession(tooShort);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('遊戲時長不能少於 10 秒');

      const tooLong = { duration: 8000, redScore: 0, blueScore: 0, status: 'waiting' as const };
      const result2 = validateGameSession(tooLong);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('遊戲時長不能超過 2 小時');
    });

    it('應該檢測負數分數', () => {
      const negativeScore = { duration: 360, redScore: -5, blueScore: 10, status: 'battle' as const };
      const result = validateGameSession(negativeScore);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('紅隊分數不能為負數');
    });

    it('應該檢測無效的狀態', () => {
      const invalidStatus = { duration: 360, redScore: 0, blueScore: 0, status: 'invalid' as any };
      const result = validateGameSession(invalidStatus);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('無效的遊戲狀態');
    });
  });

  describe('getFirestoreErrorMessage', () => {
    it('應該處理 permission-denied 錯誤', () => {
      const error = { code: 'permission-denied', message: 'No permission' };
      const msg = getFirestoreErrorMessage(error, '讀取', 'test/path');
      expect(msg).toContain('權限不足');
      expect(msg).toContain('test/path');
    });

    it('應該處理 not-found 錯誤', () => {
      const error = { code: 'not-found', message: 'Not found' };
      const msg = getFirestoreErrorMessage(error, '讀取', 'missing/path');
      expect(msg).toContain('資源未找到');
    });

    it('應該處理 unauthenticated 錯誤', () => {
      const error = { code: 'unauthenticated', message: 'Unauthenticated' };
      const msg = getFirestoreErrorMessage(error, '寫入');
      expect(msg).toContain('未認證');
    });

    it('應該處理未知錯誤代碼', () => {
      const error = { code: 'unknown-code', message: 'Some error' };
      const msg = getFirestoreErrorMessage(error, '操作');
      expect(msg).toContain('操作失敗');
      expect(msg).toContain('Some error');
    });

    it('應該處理沒有 code 屬性的錯誤對象', () => {
      const error = { message: 'Generic error' };
      const msg = getFirestoreErrorMessage(error, '操作');
      expect(msg).toContain('操作失敗');
    });
  });
});
