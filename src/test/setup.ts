/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import '@testing-library/jest-dom';

// 全局測試設置
beforeEach(() => {
  // 清理所有 mock
  vi.clearAllMocks();
});

// 模擬 window.speechSynthesis
Object.defineProperty(window, 'speechSynthesis', {
  value: {
    getVoices: () => [],
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onvoiceschanged: null
  },
  writable: true
});

// 模擬 SpeechSynthesisUtterance
(window as any).SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
  text: string;
  voice: any = null;
  rate: number = 1;
  pitch: number = 1;
  volume: number = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  
  constructor(text: string = '') {
    this.text = text;
  }
};
