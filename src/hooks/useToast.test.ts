/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';

describe('useToast Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 模擬 setTimeout 以便立即執行
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('應該初始化為空 toasts 數組', () => {
    const { result } = renderHook(() => useToast());
    
    expect(result.current.toasts).toEqual([]);
  });

  it('應該添加成功消息', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.success('操作成功');
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].message).toBe('操作成功');
  });

  it('應該添加錯誤消息', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.error('發生錯誤');
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('error');
    expect(result.current.toasts[0].message).toBe('發生錯誤');
  });

  it('應該添加警告消息', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.warning('注意警告');
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('warning');
  });

  it('應該添加信息消息', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.info('系統信息');
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('info');
  });

  it('應該在指定時間後自動移除 toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.success('測試消息', 5000);
    });
    
    expect(result.current.toasts).toHaveLength(1);
    
    // 快進時間超過 5 秒
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    
    expect(result.current.toasts).toHaveLength(0);
  });

  it('應該手動移除 toast', () => {
    const { result } = renderHook(() => useToast());
    
    let toastId: string;
    act(() => {
      result.current.success('測試消息');
      toastId = result.current.toasts[0].id;
    });
    
    expect(result.current.toasts).toHaveLength(1);
    
    act(() => {
      result.current.removeToast(toastId!);
    });
    
    expect(result.current.toasts).toHaveLength(0);
  });

  it('應該支持多條 toast 同時存在', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.success('消息 1');
      result.current.error('消息 2');
      result.current.info('消息 3');
    });
    
    expect(result.current.toasts).toHaveLength(3);
  });
});
