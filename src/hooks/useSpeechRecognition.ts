/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  lastCommand: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  supported: boolean;
}

/**
 * 語音識別 Hook
 * 封裝 Web Speech Recognition API，支持語音命令控制
 */
export function useSpeechRecognition(onCommand?: (command: string) => void): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const supported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
  }, []);

  const startListening = useCallback(() => {
    if (!supported) {
      console.warn('Speech Recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || 
                              (window as any).webkitSpeechRecognition;
    
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'zh-TW';

    rec.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    rec.onresult = (event: any) => {
      const lastResultIndex = event.results.length - 1;
      const text = event.results[lastResultIndex][0].transcript.trim().toLowerCase();
      setLastCommand(text);
      
      if (onCommand) {
        onCommand(text);
      }
    };

    rec.onerror = (event: any) => {
      console.error('Speech Recognition Error:', event.error);
      if (event.error === 'not-allowed') {
        setError('MIC_PERMISSION_DENIED');
        setIsListening(false);
      }
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
  }, [supported, onCommand]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    lastCommand,
    error,
    startListening,
    stopListening,
    supported
  };
}
