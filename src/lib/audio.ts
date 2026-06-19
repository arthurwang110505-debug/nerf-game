/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let audioCtx: AudioContext | null = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// Low-level helper to schedule a synth beep
function synthTone(
  freqs: number[],
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.1,
  sweepFreq?: number
) {
  try {
    const ctx = initAudio();
    if (!ctx) return;
    
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = type;
    
    if (freqs.length === 1) {
      osc.frequency.setValueAtTime(freqs[0], now);
      if (sweepFreq) {
        osc.frequency.exponentialRampToValueAtTime(sweepFreq, now + duration);
      }
    } else {
      // Step notes
      freqs.forEach((freq, idx) => {
        osc.frequency.setValueAtTime(freq, now + (duration / freqs.length) * idx);
      });
    }
    
    // Smooth volume envelope to prevent clicking
    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + duration);
  } catch (e) {
    console.warn("Audio Context failed to play synth:", e);
  }
}

export const playBeep = (freq = 440, duration = 0.15, type: OscillatorType = "sine") => {
  synthTone([freq], duration, type, 0.1);
};

export const playJoin = () => {
  // Rising electronic sci-fi chime
  synthTone([440, 554, 659, 880], 0.3, "sine", 0.15);
};

export const playAlarm = (times = 3) => {
  // A military emergency synth sweeping frequency
  try {
    const ctx = initAudio();
    if (!ctx) return;
    
    let delay = 0;
    for (let i = 0; i < times; i++) {
      setTimeout(() => {
        synthTone([150], 0.4, "sawtooth", 0.1, 700);
      }, delay);
      delay += 550;
    }
  } catch (e) {
    console.warn(e);
  }
};

export const playCapture = () => {
  // Fun, fast triumphant digital arcade riser
  try {
    const ctx = initAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Two fast oscillators playing harmony
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
      setTimeout(() => {
        synthTone([freq], 0.15, "triangle", 0.15, freq * 1.5);
      }, index * 80);
    });
  } catch (e) {
    console.warn(e);
  }
};

export const playHit = () => {
  // Dissolving metallic laser zap
  synthTone([800], 0.25, "square", 0.1, 80);
};

export const playMedic = () => {
  // Uplifting magical futuristic heal effect
  try {
    const ctx = initAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Generate layered rising frequency sweeps
    synthTone([300], 0.4, "sine", 0.15, 1200);
    setTimeout(() => {
      synthTone([450], 0.35, "sine", 0.1, 1500);
    }, 100);
  } catch (e) {
    console.warn(e);
  }
};

export const playSupply = () => {
  // Fast bubbly items chime
  synthTone([350, 480, 520, 680, 800], 0.4, "triangle", 0.15);
};

export const playVictory = (team: "red" | "blue") => {
  // Short electronic futuristic anthem
  const notes = team === "red" 
    ? [293.66, 349.23, 440.00, 587.33, 440.00, 587.33] // Red theme: deep minor/courageous sawtooth notes
    : [329.63, 392.00, 493.88, 659.25, 493.88, 659.25]; // Blue theme: hopeful major notes
    
  try {
    const ctx = initAudio();
    if (!ctx) return;
    
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        synthTone([freq], 0.25, "sawtooth", 0.15, freq * 1.05);
      }, idx * 180);
    });
  } catch (e) {
    console.warn(e);
  }
};

export const playClick = () => {
  initAudio();
  synthTone([1200], 0.05, "sine", 0.08, 400);
};
