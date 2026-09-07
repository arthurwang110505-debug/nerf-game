/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import type { SpeechOptions } from '../types';

interface UseSpeechSynthesisReturn {
  availableVoices: SpeechSynthesisVoice[];
  selectedVoiceURI: string;
  speechRate: number;
  speechPitch: number;
  isSpeaking: boolean;
  setSelectedVoiceURI: (uri: string) => void;
  setSpeechRate: (rate: number) => void;
  setSpeechPitch: (pitch: number) => void;
  speak: (text: string, options?: Partial<SpeechOptions>) => void;
  cancel: () => void;
}

/**
 * Web Speech API Hook
 * 封裝語音合成功能，提供統一的語音播報接口
 */
export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(1.1);
  const [speechPitch, setSpeechPitch] = useState<number>(0.9);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // 載入可用語音
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        
        // 優先選擇繁體中文語音
        const preferred = voices.find(
          v => v.lang.includes('zh-TW') || v.lang.includes('zh-HK') || v.lang.includes('zh-CN') || v.lang.includes('zh')
        );
        
        if (preferred) {
          setSelectedVoiceURI(preferred.voiceURI);
        } else if (voices.length > 0) {
          setSelectedVoiceURI(voices[0].voiceURI);
        }
      };

      loadVoices();
      
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  const speak = useCallback((text: string, options?: Partial<SpeechOptions>) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('Speech Synthesis not supported');
      return;
    }

    // 取消當前正在播放的語音
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // 應用選項
    const voice = availableVoices.find(v => v.voiceURI === (options?.voiceURI || selectedVoiceURI));
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = options?.rate ?? speechRate;
    utterance.pitch = options?.pitch ?? speechPitch;
    utterance.volume = options?.volume ?? 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [availableVoices, selectedVoiceURI, speechRate, speechPitch]);

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    availableVoices,
    selectedVoiceURI,
    speechRate,
    speechPitch,
    isSpeaking,
    setSelectedVoiceURI,
    setSpeechRate,
    setSpeechPitch,
    speak,
    cancel
  };
}
