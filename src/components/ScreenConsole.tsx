/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  addDoc
} from "firebase/firestore";
import { 
  db, 
  appId, 
  OperationType, 
  handleFirestoreError 
} from "../lib/firebase";
import { GameSession, GameLog, PlayerState } from "../types";
import { 
  playClick, 
  playAlarm, 
  playBeep, 
  playVictory, 
  playCapture, 
  playMedic,
  playJoin
} from "../lib/audio";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import { 
  Shield, 
  Skull, 
  Heart, 
  Radio, 
  Award, 
  Play, 
  RotateCcw, 
  Plus, 
  Minus, 
  Volume2, 
  Users, 
  Activity, 
  Trophy,
  Compass,
  VolumeX,
  Volume1,
  MessageSquareOff,
  Mic
} from "lucide-react";
import { globalEventBus, TacticalEvents } from "../lib/eventBus";

interface ScreenConsoleProps {
  onShowQR: () => void;
}

export default function ScreenConsole({ onShowQR }: ScreenConsoleProps) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Web Speech API Voice States
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");
  const [speechRate, setSpeechRate] = useState<number>(1.1);
  const [speechPitch, setSpeechPitch] = useState<number>(0.9);

  // Sound triggers on new events
  const lastLogsCount = useRef(0);

  // Voice Command Recognizer & Highlight States
  const [isListening, setIsListening] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [lastSpeechCommand, setLastSpeechCommand] = useState<string>("");
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Real-time Tactical Score Trend Tracker
  const [scoreTrend, setScoreTrend] = useState<{ time: string; red: number; blue: number }[]>([]);

  // Load available speech voices on support
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        // Preference: Traditional Chinese (TW/HK), standard Chinese (CN)
        const preferred = voices.find(
          (v) => v.lang.includes("zh-TW") || v.lang.includes("zh-HK") || v.lang.includes("zh-CN") || v.lang.includes("zh")
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

  // Track Real-time Score Trends
  useEffect(() => {
    if (session?.status === "battle") {
      const currentTimeStr = formatTimer(session.duration - session.timeRemaining);
      setScoreTrend(prev => {
        // Limit record duplicates for the same timescale segment
        if (prev.some(p => p.time === currentTimeStr)) return prev;
        return [...prev, { time: currentTimeStr, red: session.redScore, blue: session.blueScore }];
      });
    } else if (session?.status === "waiting") {
      setScoreTrend([{ time: "00:00", red: 0, blue: 0 }]);
    }
  }, [session?.timeRemaining, session?.status]);

  // Set up Speech Recognition commands listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "zh-TW"; // Recognize Traditional Chinese commands

      rec.onstart = () => {
        setIsListening(true);
        setRecognitionError(null);
      };

      rec.onresult = async (event: any) => {
        const lastResultIndex = event.results.length - 1;
        const text = event.results[lastResultIndex][0].transcript.trim().toLowerCase();
        setLastSpeechCommand(text);

        // Process Voice Commands
        if (text.includes("重置") || text.includes("reset") || text.includes("重設")) {
          playAlarm(1);
          await handleResetSessionDirect();
        } else if (text.includes("暫停") || text.includes("pause")) {
          playBeep(420, 0.35, "sawtooth");
          await handlePauseSession();
        } else if (text.includes("開始") || text.includes("作戰") || text.includes("start") || text.includes("resume") || text.includes("恢復")) {
          if (session?.status === "paused") {
            playBeep(650, 0.25, "sine");
            await handleResumeSession();
          } else if (session?.status === "waiting") {
            startBriefingAndBattle();
          }
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Err:", event.error);
        if (event.error === "not-allowed") {
          setRecognitionError("MIC_PERMISSION_DENIED");
          setIsListening(false);
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    } else {
      console.warn("SpeechRecognition not supported in browser.");
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [session?.status, session?.duration, session?.redScore, session?.blueScore]);

  // Subscribe to public active session document
  useEffect(() => {
    const sessionDocRef = doc(db, "artifacts", appId, "public", "data", "game_sessions", "active_session");
    
    const unsubscribe = onSnapshot(sessionDocRef, (snap) => {
      if (snap.exists()) {
        setSession(snap.data() as GameSession);
      } else {
        // Automatically provision an initial session if none exists
        initializeDefaultSession();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "game_sessions/active_session");
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to players collection
  useEffect(() => {
    const playersColRef = collection(db, "artifacts", appId, "public", "data", "players");
    
    const unsubscribe = onSnapshot(playersColRef, (snap) => {
      const pList: PlayerState[] = [];
      snap.forEach((docSnap) => {
        pList.push({ uid: docSnap.id, ...docSnap.data() } as PlayerState);
      });
      setPlayers(pList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "players");
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to game logs (No query filters for simplicity and zero-index errors, sort in-memory)
  useEffect(() => {
    const logsColRef = collection(db, "artifacts", appId, "public", "data", "game_logs");
    
    const unsubscribe = onSnapshot(logsColRef, (snap) => {
      const lList: GameLog[] = [];
      snap.forEach((docSnap) => {
        lList.push({ id: docSnap.id, ...docSnap.data() } as GameLog);
      });
      // Sort in memory by timestamp descending (newest first) or ascending
      const sorted = lList.sort((a, b) => a.timestamp - b.timestamp);
      setLogs(sorted);

      // Play chime if we got a new log entry
      if (lList.length > lastLogsCount.current && lastLogsCount.current > 0) {
        const latest = sorted[sorted.length - 1];
        
        // Push through unified local Event Bus
        globalEventBus.emit(TacticalEvents.QR_SCANNED, latest);
        if (latest.type === "join" || latest.type === "hit") {
          globalEventBus.emit(TacticalEvents.PLAYER_STATE_CHANGED, latest);
        }

        if (latest.type === "scan") playCapture();
        else if (latest.type === "medic") playMedic();
        else if (latest.type === "join") playJoin();
        else playBeep(350, 0.15, "triangle");
      }
      lastLogsCount.current = lList.length;
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "game_logs");
    });

    return () => unsubscribe();
  }, []);

  // Handle local countdown tick if state is "battle" and we are the active Screen view
  useEffect(() => {
    if (!session || session.status !== "battle") return;

    const timer = setInterval(async () => {
      const nextRemaining = session.timeRemaining - 1;
      
      const sessionDocRef = doc(db, "artifacts", appId, "public", "data", "game_sessions", "active_session");
      if (nextRemaining <= 0) {
        // Game completed
        clearInterval(timer);
        
        // Determine winner
        let winnerMsg = "戰役結束！雙方拼盡全力，握手言和！";
        let winningTeam: "red" | "blue" | null = null;
        if (session.redScore > session.blueScore) {
          winnerMsg = "護盾警報解除！戰役結束，紅隊 (Red Faction) 獲得了最終勝利！";
          winningTeam = "red";
        } else if (session.blueScore > session.redScore) {
          winnerMsg = "護盾警報解除！戰役結束，藍隊 (Blue Faction) 獲得了最終勝利！";
          winningTeam = "blue";
        }

        try {
          await updateDoc(sessionDocRef, {
            timeRemaining: 0,
            status: "finished"
          });

          // Trigger local event bus notification
          globalEventBus.emit(TacticalEvents.TIMER_EXPIRED, { winner: winningTeam });

          // Write a final log
          await addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
            timestamp: Date.now(),
            callsign: "SYSTEM_CENTER",
            faction: "system",
            message: winnerMsg,
            type: "system"
          });

          if (winningTeam) {
            playVictory(winningTeam);
          } else {
            playAlarm(2);
          }
        } catch (e) {
          console.error("Failed to end game session", e);
        }
      } else {
        // Regular tick update
        try {
          await updateDoc(sessionDocRef, {
            timeRemaining: nextRemaining
          });
        } catch (e) {
          console.error("Timer update error:", e);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.status, session?.timeRemaining]);

  // Scroll logs automatically
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Push fallback default session configuration
  const initializeDefaultSession = async () => {
    const sessionDocRef = doc(db, "artifacts", appId, "public", "data", "game_sessions", "active_session");
    try {
      await setDoc(sessionDocRef, {
        redScore: 0,
        blueScore: 0,
        duration: 360, // 6 minutes as initial setting
        timeRemaining: 360,
        status: "waiting",
        updatedAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "game_sessions/active_session");
    }
  };

  // Adjust/Set custom timer duration
  const handleSetDuration = async (seconds: number) => {
    if (seconds < 10) return;
    const sessionDocRef = doc(db, "artifacts", appId, "public", "data", "game_sessions", "active_session");
    try {
      await updateDoc(sessionDocRef, {
        duration: seconds,
        timeRemaining: seconds,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.error("Failed to update session duration", e);
    }
  };

  // Calculate AAR Debriefing Statistics from logs
  const calculateDebriefingStats = () => {
    // 1. Total scans (including flag QR scans, medical scans, and supplies scans)
    const redScans = logs.filter(l => l.faction === "red" && (l.type === "scan" || l.type === "medic" || l.type === "supply")).length;
    const blueScans = logs.filter(l => l.faction === "blue" && (l.type === "scan" || l.type === "medic" || l.type === "supply")).length;

    // Subcategories for advanced breakdown lists
    const redFlagScans = logs.filter(l => l.faction === "red" && l.type === "scan").length;
    const blueFlagScans = logs.filter(l => l.faction === "blue" && l.type === "scan").length;
    const redMedicScans = logs.filter(l => l.faction === "red" && l.type === "medic").length;
    const blueMedicScans = logs.filter(l => l.faction === "blue" && l.type === "medic").length;

    // 2. Control Time (控制時間): Calculate duration based on alternating scan (capture) sequence
    const battleStartLog = logs.find(l => l.message.includes("倒數計時正式展開"));
    const battleStartTs = battleStartLog ? battleStartLog.timestamp : (logs[0]?.timestamp || Date.now());
    const finishedLog = logs.find(l => l.message.includes("戰役結束"));
    const battleEndTs = finishedLog ? finishedLog.timestamp : Date.now();

    let redTimeMs = 0;
    let blueTimeMs = 0;
    let currentController: "red" | "blue" | null = null;
    let currentControllerStartTime = battleStartTs;

    const controlLogs = logs.filter(l => l.timestamp >= battleStartTs && l.timestamp <= battleEndTs && l.type === "scan");

    for (const log of controlLogs) {
      const nextController = log.faction as "red" | "blue";
      if (currentController) {
        const span = log.timestamp - currentControllerStartTime;
        if (currentController === "red") redTimeMs += span;
        else if (currentController === "blue") blueTimeMs += span;
      }
      currentController = nextController;
      currentControllerStartTime = log.timestamp;
    }

    if (currentController) {
      const span = Math.max(0, battleEndTs - currentControllerStartTime);
      if (currentController === "red") redTimeMs += span;
      else if (currentController === "blue") blueTimeMs += span;
    }

    let redCtrlSec = Math.floor(redTimeMs / 1000);
    let blueCtrlSec = Math.floor(blueTimeMs / 1000);
    const totalDuration = session?.duration || 360;

    // Normalize so control duration cannot exceed total set battle timer
    if (redCtrlSec + blueCtrlSec > totalDuration) {
      const ratio = totalDuration / (redCtrlSec + blueCtrlSec);
      redCtrlSec = Math.floor(redCtrlSec * ratio);
      blueCtrlSec = Math.floor(blueCtrlSec * ratio);
    }

    // 3. Game MVP leaderboard stats
    const playerStats: Record<string, { callsign: string; faction: "red" | "blue"; scans: number; hits: number; heals: number }> = {};
    players.forEach(p => {
      playerStats[p.callsign] = { callsign: p.callsign, faction: p.faction, scans: 0, hits: 0, heals: 0 };
    });

    logs.forEach(log => {
      if (!log.callsign) return;
      if (!playerStats[log.callsign]) {
        playerStats[log.callsign] = { callsign: log.callsign, faction: log.faction as "red" | "blue" || "red", scans: 0, hits: 0, heals: 0 };
      }
      if (log.type === "scan") {
        playerStats[log.callsign].scans += 1;
      } else if (log.type === "hit") {
        playerStats[log.callsign].hits += 1;
      } else if (log.type === "medic") {
        playerStats[log.callsign].heals += 1;
      }
    });

    const sortedPlayers = Object.values(playerStats).sort((a, b) => b.scans - a.scans || b.heals - a.heals);

    return {
      redScans,
      blueScans,
      redFlagScans,
      blueFlagScans,
      redMedicScans,
      blueMedicScans,
      redCtrlSec,
      blueCtrlSec,
      mvpList: sortedPlayers.slice(0, 3)
    };
  };

  const handleResetSession = async () => {
    playClick();
    if (!confirm("確定要重設目前這場 NERF 戰役的所有分數與狀態嗎？玩家名單將會保留。")) return;

    const sessionDocRef = doc(db, "artifacts", appId, "public", "data", "game_sessions", "active_session");
    try {
      await updateDoc(sessionDocRef, {
        redScore: 0,
        blueScore: 0,
        timeRemaining: session?.duration || 360,
        status: "waiting",
        updatedAt: Date.now()
      });

      // Clear/Add start signal log
      await addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
        timestamp: Date.now(),
        callsign: "COMMAND_HQ",
        faction: "system",
        message: "【指揮部廣播】戰役重設完成。等待特工部隊重整態勢！",
        type: "system"
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetSessionDirect = async () => {
    const sessionDocRef = doc(db, "artifacts", appId, "public", "data", "game_sessions", "active_session");
    try {
      await updateDoc(sessionDocRef, {
        redScore: 0,
        blueScore: 0,
        timeRemaining: session?.duration || 360,
        status: "waiting",
        updatedAt: Date.now()
      });

      await addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
        timestamp: Date.now(),
        callsign: "COMMAND_HQ",
        faction: "system",
        message: "【語音指令】指揮官下達「重置戰局」語音指令，戰事重新設置完畢。",
        type: "system"
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handlePauseSession = async () => {
    if (!session || session.status !== "battle") return;
    const sessionDocRef = doc(db, "artifacts", appId, "public", "data", "game_sessions", "active_session");
    try {
      await updateDoc(sessionDocRef, {
        status: "paused",
        updatedAt: Date.now()
      });

      await addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
        timestamp: Date.now(),
        callsign: "COMMAND_HQ",
        faction: "system",
        message: "【語音指令】指揮官已透過語音啟動「暫停戰役」指令，各隊計時凍結！",
        type: "system"
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleResumeSession = async () => {
    if (!session || session.status !== "paused") return;
    const sessionDocRef = doc(db, "artifacts", appId, "public", "data", "game_sessions", "active_session");
    try {
      await updateDoc(sessionDocRef, {
        status: "battle",
        updatedAt: Date.now()
      });

      await addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
        timestamp: Date.now(),
        callsign: "COMMAND_HQ",
        faction: "system",
        message: "【語音指令】指揮官已透過語音啟動「恢復戰役」指令，交火重啟！",
        type: "system"
      });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleListening = () => {
    playClick();
    if (!recognitionRef.current) {
      alert("您的瀏覽器尚未與 Web Speech API 語音辨識連通。建議使用 Google Chrome 瀏覽器測試。");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Speech Recognition startup error:", err);
      }
    }
  };

  const startBriefingAndBattle = () => {
    playClick();
    if (!session) return;
    
    const briefingText = "全體特工注意！NERF 實境奪旗戰即將開始。紅隊與藍隊請各自退回基地。獲勝條件：突破敵方火力，並用手機掃描敵方基地的二維碼。如果中彈，請立刻前往中立區掃描醫療箱二維碼，罰站十秒後方可復活。祝各位特工好運，戰役在五秒後正式打響！";

    // 1. Trigger Speech briefing first
    setIsSpeaking(true);
    globalEventBus.emit(TacticalEvents.VOICE_BROADCAST, { text: briefingText, status: "speaking" });
    
    // Add start log notice
    addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
      timestamp: Date.now(),
      callsign: "SYSTEM_VOICE",
      faction: "system",
      message: "【作戰簡報】正在向全體特工播放廣播語音指令...",
      type: "system"
    });

    if (!("speechSynthesis" in window)) {
      // No synthesis engine available
      triggerBattleStart();
      return;
    }

    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(briefingText);
    
    // Setup Voice Parameters from customizable states
    if (availableVoices.length > 0) {
      const selected = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
      if (selected) {
        utterance.voice = selected;
      } else {
        const targetVoice = availableVoices.find(v => v.lang.includes("zh-TW") || v.lang.includes("zh-CN") || v.lang.includes("zh"));
        if (targetVoice) utterance.voice = targetVoice;
      }
    }
    
    utterance.lang = "zh-TW";
    utterance.rate = speechRate;
    utterance.pitch = speechPitch;
    
    // Safeguard backup: of speech fails to speak or is blocked, auto-progress after 15 seconds
    const safetyBackup = setTimeout(() => {
      console.warn("Speech Synthesis safety timeout fired.");
      triggerBattleStart();
    }, 15000);

    utterance.onend = () => {
      clearTimeout(safetyBackup);
      triggerBattleStart();
    };

    utterance.onerror = (e) => {
      console.error("Speech Synthesis utterance error:", e);
      clearTimeout(safetyBackup);
      triggerBattleStart();
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopBriefingSpeech = () => {
    playClick();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    globalEventBus.emit(TacticalEvents.VOICE_BROADCAST, { text: "", status: "stopped" });
    triggerBattleStart();
  };

  const triggerBattleStart = async () => {
    setIsSpeaking(false);
    playAlarm(2); // Sirens

    setTimeout(async () => {
      const sessionDocRef = doc(db, "artifacts", appId, "public", "data", "game_sessions", "active_session");
      try {
        await updateDoc(sessionDocRef, {
          status: "battle",
          updatedAt: Date.now()
        });

        await addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
          timestamp: Date.now(),
          callsign: "COMMAND_HQ",
          faction: "system",
          message: "【戰嚎拉響】倒數計時正式展開！各小隊，進攻！",
          type: "system"
        });
      } catch (err) {
        console.error(err);
      }
    }, 1200);
  };

  const adjustScore = async (faction: "red" | "blue", amount: number) => {
    playClick();
    if (!session) return;
    
    const sessionDocRef = doc(db, "artifacts", appId, "public", "data", "game_sessions", "active_session");
    const currentScore = faction === "red" ? session.redScore : session.blueScore;
    const nextScore = Math.max(0, currentScore + amount);

    try {
      if (faction === "red") {
        await updateDoc(sessionDocRef, { redScore: nextScore });
      } else {
        await updateDoc(sessionDocRef, { blueScore: nextScore });
      }

      await addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
        timestamp: Date.now(),
        callsign: "HQ_JUDGE",
        faction: faction,
        message: `【裁判調整】${faction === "red" ? "紅隊" : "藍隊"}得分調整了 ${amount > 0 ? "+" + amount : amount} 分。目前：${nextScore}`,
        type: "system"
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Convert seconds to beautifully padded string MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 w-full bg-slate-950 text-slate-200 font-mono p-4 overflow-hidden select-none flex flex-col justify-between relative">
      {/* Background Grid Accent */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.15)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

      {/* Header Section */}
      <header className="relative z-10 flex items-center justify-between border-b border-cyan-900/50 pb-4 mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 border-2 border-cyan-500 flex items-center justify-center">
            <div className="w-8 h-8 bg-cyan-500/20 flex items-center justify-center animate-pulse">
              <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-cyan-400">
              NERF TACTICAL <span className="text-slate-500">v3.5</span>
            </h1>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#0e7490]">
              <span className="animate-pulse">●</span> COMMAND CENTER // SYSTEM_ONLINE // APP_{appId.substring(0, 8).toUpperCase()}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-slate-900 border border-slate-700 text-xs flex flex-col items-end justify-center">
            <span className="text-slate-500 text-[10px]">SESSION ID</span>
            <span className="text-cyan-400 font-bold font-mono">NTX-2026-DELTA</span>
          </div>
          <div className="px-4 py-2 bg-red-950/20 border border-red-900/50 text-xs flex flex-col items-end justify-center">
            <span className="text-red-500 text-[10px]">BATTLE STATUS</span>
            <span className="text-red-400 text-lg font-bold uppercase">
              {session ? session.status : "INIT"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Command Grid - Stable 16:9 Tactical Dashboard */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 overflow-hidden min-h-0 min-w-0">
        
        {/* Left column: Roster List & Signal latency panel */}
        <aside className="col-span-1 lg:col-span-3 flex flex-col gap-3 overflow-hidden min-h-0 h-full">
          <div className="flex-1 border border-slate-800 bg-slate-900/30 p-3 flex flex-col min-h-0">
            <div className="text-[10px] uppercase text-slate-500 mb-3 border-b border-slate-800 pb-1 flex justify-between shrink-0">
              <span>Active Agents (特工名單)</span>
              <span className="text-cyan-500 font-bold">{players.length} Online</span>
            </div>
            
            {/* Roster database feedback */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {players.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-8 gap-2">
                  <span className="text-xs">【等待特工連線】</span>
                  <p className="text-[9px] text-slate-600 max-w-[170px] leading-relaxed">
                    請開啟「手機端特工」登入陣營代號，資料將實時加入戰場。
                  </p>
                </div>
              ) : (
                players.map((p) => {
                  const isRed = p.faction === "red";
                  let borderCol = isRed ? "border-red-500" : "border-blue-500";
                  let bgCol = isRed ? "bg-red-950/20" : "bg-blue-950/20";
                  let statTag = "READY";
                  let tagBg = isRed ? "bg-red-500 text-black" : "bg-blue-500 text-black";

                  if (p.status === "dead") {
                    borderCol = "border-slate-500";
                    bgCol = "bg-slate-800/10 grayscale opacity-60";
                    statTag = "DOWN";
                    tagBg = "bg-slate-500 text-black";
                  } else if (p.status === "respawning") {
                    statTag = `${p.respawnTimer}S`;
                    tagBg = "bg-amber-500 text-black animate-pulse";
                  }

                  const isHighlighted = highlightedPlayer === p.callsign;

                  return (
                    <div 
                      key={p.uid}
                      onClick={() => {
                        playClick();
                        setHighlightedPlayer(isHighlighted ? null : p.callsign);
                      }}
                      className={`flex items-center justify-between p-2 border-l-4 ${borderCol} ${bgCol} cursor-pointer transition-all ${
                        isHighlighted 
                          ? "ring-2 ring-yellow-400 border-r-2 border-r-yellow-400 bg-yellow-400/10 shadow-[0_0_12px_rgba(234,179,8,0.3)] animate-pulse scale-[1.02]" 
                          : "hover:bg-slate-900/60"
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-slate-200">{p.callsign}</span>
                        <span className="text-[8px] text-slate-500 uppercase">{isRed ? "Red Faction" : "Blue Faction"}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 font-bold ${tagBg}`}>
                        {statTag}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Commander Mic Voice Control system */}
          <div className="border border-slate-800 bg-slate-900/40 p-3 shrink-0 flex flex-col gap-2 rounded-sm">
            <div className="text-[10px] uppercase text-slate-500 flex justify-between items-center border-b border-slate-800 pb-1">
              <span className="flex items-center gap-1.5 font-bold tracking-wider">
                <Mic className={`w-3.5 h-3.5 ${isListening ? "text-green-400 animate-pulse" : "text-slate-600"}`} />
                <span>戰地指揮官語音監聽處</span>
              </span>
              <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${isListening ? "bg-green-500 text-black animate-pulse" : "bg-slate-800 text-slate-400"}`}>
                {isListening ? "LISTENING" : "OFFLINE"}
              </span>
            </div>

            <button
              onClick={toggleListening}
              className={`w-full py-1.5 rounded font-bold text-[9px] flex items-center justify-center gap-1.5 transition-all outline-none ${
                isListening
                  ? "bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 animate-pulse"
                  : "bg-green-600 hover:bg-green-500 text-black"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isListening ? "關閉語音監聽" : "開啟麥克風監聽"}</span>
            </button>

            {/* Command references */}
            <div className="text-[8px] space-y-1 bg-slate-950/60 p-2 border border-slate-900 rounded font-mono text-slate-400">
              <div className="text-[7.5px] text-slate-500 uppercase tracking-wider mb-1 border-b border-slate-900 pb-0.5 font-bold">戰役聲控指令引導:</div>
              <div className="flex justify-between">
                <span className="text-cyan-400">「重置戰局」 / 「重設」:</span>
                <span className="text-slate-500">歸零歸檔分數</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cyan-400">「暫停戰役」 / 「暫停」:</span>
                <span className="text-slate-500">凍結戰局計時</span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-500">「開始作戰」 / 「恢復」:</span>
                <span className="text-slate-500">啟動或恢復交火</span>
              </div>
            </div>

            {recognitionError && (
              <div className="text-[8px] text-red-400 font-bold bg-red-950/20 px-2 py-1 rounded border border-red-900/40">
                授權提醒: {recognitionError === "MIC_PERMISSION_DENIED" ? "請核准麥克風存取權限" : "聲控重聯中..."}
              </div>
            )}

            {lastSpeechCommand && (
              <div className="text-[9px] flex flex-col gap-0.5 bg-black/40 p-1.5 border border-slate-900 rounded">
                <span className="text-slate-500 text-[7px] uppercase">當前辨識語音命令:</span>
                <span className="text-cyan-400 font-bold max-w-full truncate">"{lastSpeechCommand}"</span>
              </div>
            )}
          </div>

          {/* Command Voice & Telemetry Module */}
          <div className="border border-slate-800 bg-slate-900/30 p-3 shrink-0 flex flex-col gap-2">
            <div className="text-[10px] uppercase text-slate-500 flex justify-between items-center border-b border-slate-800 pb-1">
              <span className="flex items-center gap-1.5 font-bold tracking-wider">
                <Radio className={`w-3.5 h-3.5 ${isSpeaking ? "text-cyan-400 animate-pulse" : "text-slate-600"}`} />
                <span>戰場語音核心廣播系統</span>
              </span>
              <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${isSpeaking ? "bg-cyan-500 text-black animate-pulse" : "bg-slate-800 text-slate-400"}`}>
                {isSpeaking ? "BROADCASTING" : "STANDBY"}
              </span>
            </div>

            {/* Simulated Audiowave Visualizer */}
            <div className="h-9 bg-black/60 border border-slate-900 rounded p-1.5 flex items-center justify-between overflow-hidden">
              {isSpeaking ? (
                <div className="flex items-end justify-center gap-1 w-full h-full">
                  <div className="w-1 bg-cyan-500 rounded h-[10%] animate-[bounce_0.6s_infinite_100ms]" />
                  <div className="w-1 bg-cyan-400 rounded h-[70%] animate-[bounce_0.6s_infinite_300ms]" />
                  <div className="w-1 bg-cyan-300 rounded h-[40%] animate-[bounce_0.6s_infinite_150ms]" />
                  <div className="w-1 bg-cyan-500 rounded h-[90%] animate-[bounce_0.6s_infinite_400ms]" />
                  <div className="w-1 bg-sky-400 rounded h-[30%] animate-[bounce_0.6s_infinite_200ms]" />
                  <div className="w-1 bg-cyan-400 rounded h-[80%] animate-[bounce_0.6s_infinite_120ms]" />
                  <div className="w-1 bg-sky-300 rounded h-[50%] animate-[bounce_0.6s_infinite_250ms]" />
                  <div className="w-1 bg-cyan-500 rounded h-[20%] animate-[bounce_0.6s_infinite_350ms]" />
                </div>
              ) : (
                <div className="w-full flex flex-col justify-center gap-1">
                  <div className="text-[8px] text-slate-500 uppercase tracking-tighter">SPEECH STATUS: SILENT WAITING</div>
                  <div className="w-full h-0.5 bg-slate-800/40 relative">
                    <div className="absolute left-[30%] top-0 w-[40%] h-full bg-cyan-500/20" />
                  </div>
                </div>
              )}
            </div>

            {/* Voice select dropdown */}
            <div className="space-y-1">
              <label className="text-[8px] text-slate-500 uppercase flex items-center justify-between">
                <span>廣播發音播報官聲音</span>
                <span className="text-cyan-500 font-mono text-[7px]">{availableVoices.length} 具備</span>
              </label>
              <select
                className="w-full bg-slate-950 text-[10px] text-cyan-400 border border-slate-800 rounded p-1 h-7 focus:outline-none focus:border-cyan-500"
                value={selectedVoiceURI}
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
              >
                {availableVoices.length === 0 ? (
                  <option value="">預設系統音 (Muted/Default)</option>
                ) : (
                  availableVoices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Sliders in a double grid */}
            <div className="grid grid-cols-2 gap-2 text-[8px]">
              <div>
                <span className="text-light-500 block text-slate-500 mb-1">語速 (SPEED): {speechRate}x</span>
                <input
                  type="range"
                  min="0.6"
                  max="1.5"
                  step="0.1"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 bg-slate-800 h-1 rounded"
                />
              </div>
              <div>
                <span className="text-light-500 block text-slate-500 mb-1">音調 (TONE): {speechPitch}x</span>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={speechPitch}
                  onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 bg-slate-800 h-1 rounded"
                />
              </div>
            </div>

            {/* Emergency voice skips or trial voices */}
            <div className="flex gap-2 pt-1 border-t border-slate-900">
              <button
                onClick={() => {
                  playClick();
                  if (!("speechSynthesis" in window)) {
                    alert("瀏覽器未支援語音播報服務。");
                    return;
                  }
                  window.speechSynthesis.cancel();
                  const tText = "作戰通訊測試：大螢幕系統廣播語音正常運作中！";
                  const utter = new SpeechSynthesisUtterance(tText);
                  if (availableVoices.length > 0) {
                    const sel = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
                    if (sel) utter.voice = sel;
                  }
                  utter.lang = "zh-TW";
                  utter.rate = speechRate;
                  utter.pitch = speechPitch;
                  window.speechSynthesis.speak(utter);
                  addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
                    timestamp: Date.now(),
                    callsign: "SYSTEM_VOICE",
                    faction: "system",
                    message: "【測試廣播】語音連線模組測試成功，通道安全暢通。",
                    type: "system"
                  });
                }}
                className="flex-1 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-[8px] flex items-center justify-center gap-1 transition-colors"
                title="測試語音"
              >
                <Volume2 className="w-3 h-3 text-cyan-400" />
                <span>發聲測試</span>
              </button>
              {isSpeaking && (
                <button
                  onClick={stopBriefingSpeech}
                  className="flex-1 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 text-red-300 font-bold text-[8px] flex items-center justify-center gap-1 transition-colors"
                  title="手動跳過大螢幕簡報"
                >
                  <MessageSquareOff className="w-3 h-3 text-red-400" />
                  <span>跳過簡報</span>
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Center Section: Scoreboard with Interactive Actions */}
        <section className="col-span-1 lg:col-span-6 flex flex-col gap-3 h-full min-h-0">
          {session?.status === "finished" ? (
            <div className="flex-1 border-2 border-slate-800 relative bg-slate-900/20 overflow-y-auto p-4 xl:p-5 scrollbar-thin scrollbar-thumb-slate-800 flex flex-col justify-between">
              {/* Grid dot indicator overlay strictly matching Elegant Dark */}
              <div 
                className="absolute inset-0 opacity-10 pointer-events-none" 
                style={{ backgroundImage: "radial-gradient(circle, #0891b2 1px, transparent 1px)", backgroundSize: "20px 20px" }}
              />
              
              {/* Scoreboard Info bar */}
              <div className="relative z-10 flex justify-between items-center text-[10px] text-slate-500 border-b border-slate-800 pb-2 shrink-0">
                <span className="tracking-widest uppercase flex items-center gap-1.5 font-bold">
                  <span className="inline-block w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                  <span>TACTICAL DEBRIEFING SYSTEM</span>
                </span>
                <span className="text-cyan-400 font-bold">MODE: MISSION_COMPLETED_AAR</span>
              </div>

              {/* Debriefing content layout */}
              {(() => {
                const debrief = calculateDebriefingStats();
                return (
                  <div className="relative z-10 flex flex-col justify-between items-center text-center py-2 flex-grow">
                    <div className="flex flex-col items-center gap-1 mb-3">
                      <span className="text-[10px] tracking-[0.3em] font-black text-amber-400 uppercase flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: "6s" }} />
                        <span>戰報簡報 // AFTER ACTION REPORT</span>
                      </span>
                      <div className="text-xl md:text-2xl font-black tracking-widest text-slate-100 mt-1">
                        {session.redScore > session.blueScore ? (
                          <span className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]">紅隊 (Red Faction) 獲得最終勝利</span>
                        ) : session.blueScore > session.redScore ? (
                          <span className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]">藍隊 (Blue Faction) 獲得最終勝利</span>
                        ) : (
                          <span className="text-slate-400 drop-shadow-[0_0_15px_rgba(148,163,184,0.6)]">戰局平手 (Tactical Draw)</span>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-500">
                        作戰時限已屆，雙方表現極其勇猛，以下為基地資料與全域戰術統計：
                      </p>
                    </div>

                    {/* Faction scoreboard grid */}
                    <div className="grid grid-cols-2 gap-3 w-full max-w-lg mb-3">
                      {/* Red stats */}
                      <div className="border border-red-900/60 bg-red-950/10 p-2.5 rounded text-left">
                        <div className="text-[9px] text-red-500 font-extrabold uppercase tracking-widest">RED TEAM ACTION SUMMARY</div>
                        <div className="text-3xl font-black text-red-500 mt-0.5">
                          {String(session.redScore).padStart(2, "0")} <span className="text-[10px] text-slate-600 font-normal">PTS</span>
                        </div>
                        <div className="mt-2 space-y-1 text-[9px]">
                          <div className="flex justify-between border-b border-red-950/40 pb-0.5">
                            <span className="text-slate-500">總掃描次數:</span>
                            <span className="text-red-400 font-bold">{debrief.redScans} 次</span>
                          </div>
                          <div className="flex justify-between border-b border-red-950/40 pb-0.5 pl-2">
                            <span className="text-slate-600">└ 敵軍奪旗:</span>
                            <span className="text-slate-400">{debrief.redFlagScans} 次</span>
                          </div>
                          <div className="flex justify-between border-b border-red-950/40 pb-0.5 pl-2">
                            <span className="text-slate-600">└ 醫療救援:</span>
                            <span className="text-slate-400">{debrief.redMedicScans} 次</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">戰區控制時間:</span>
                            <span className="text-cyan-400 font-bold">{formatTimer(debrief.redCtrlSec)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Blue stats */}
                      <div className="border border-blue-900/60 bg-blue-950/10 p-2.5 rounded text-left">
                        <div className="text-[9px] text-blue-500 font-extrabold uppercase tracking-widest">BLUE TEAM ACTION SUMMARY</div>
                        <div className="text-3xl font-black text-blue-500 mt-0.5">
                          {String(session.blueScore).padStart(2, "0")} <span className="text-[10px] text-slate-600 font-normal">PTS</span>
                        </div>
                        <div className="mt-2 space-y-1 text-[9px]">
                          <div className="flex justify-between border-b border-blue-950/40 pb-0.5">
                            <span className="text-slate-500">總掃描次數:</span>
                            <span className="text-blue-400 font-bold">{debrief.blueScans} 次</span>
                          </div>
                          <div className="flex justify-between border-b border-blue-950/40 pb-0.5 pl-2">
                            <span className="text-slate-600">└ 敵軍奪旗:</span>
                            <span className="text-slate-400">{debrief.blueFlagScans} 次</span>
                          </div>
                          <div className="flex justify-between border-b border-blue-950/40 pb-0.5 pl-2">
                            <span className="text-slate-600">└ 醫療救援:</span>
                            <span className="text-slate-400">{debrief.blueMedicScans} 次</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">戰區控制時間:</span>
                            <span className="text-cyan-400 font-bold">{formatTimer(debrief.blueCtrlSec)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Ratios visualization */}
                    <div className="w-full max-w-lg mb-3 bg-slate-950/80 p-2 border border-slate-900 rounded text-left space-y-2 text-[9px]">
                      <div className="text-[8.5px] text-slate-500 uppercase tracking-widest font-black">戰地控制率與奪旗掃描比重 (Tactical Proportion)</div>
                      
                      {/* Control duration ratio bar */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[8px]">
                          <span className="text-red-400">紅隊控制比率: {Math.round(debrief.redCtrlSec / (debrief.redCtrlSec + debrief.blueCtrlSec || 1) * 100)}%</span>
                          <span className="text-blue-400">藍隊控制比率: {Math.round(debrief.blueCtrlSec / (debrief.redCtrlSec + debrief.blueCtrlSec || 1) * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded overflow-hidden flex">
                          <div className="bg-red-500 h-full transition-all" style={{ width: `${(debrief.redCtrlSec / (debrief.redCtrlSec + debrief.blueCtrlSec || 1)) * 100}%` }} />
                          <div className="bg-blue-500 h-full transition-all" style={{ width: `${(debrief.blueCtrlSec / (debrief.redCtrlSec + debrief.blueCtrlSec || 1)) * 100}%` }} />
                        </div>
                      </div>

                      {/* Flag capture ratio bar */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[8px]">
                          <span className="text-red-400">紅隊得分掃描: {debrief.redFlagScans}次 ({Math.round(debrief.redFlagScans / (debrief.redFlagScans + debrief.blueFlagScans || 1) * 100)}%)</span>
                          <span className="text-blue-400">藍隊得分掃描: {debrief.blueFlagScans}次 ({Math.round(debrief.blueFlagScans / (debrief.redFlagScans + debrief.blueFlagScans || 1) * 100)}%)</span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded overflow-hidden flex">
                          <div className="bg-red-500/85 h-full transition-all" style={{ width: `${(debrief.redFlagScans / (debrief.redFlagScans + debrief.blueFlagScans || 1)) * 100}%` }} />
                          <div className="bg-blue-500/85 h-full transition-all" style={{ width: `${(debrief.blueFlagScans / (debrief.redFlagScans + debrief.blueFlagScans || 1)) * 100}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* MVPs leaderboard summary */}
                    <div className="w-full max-w-lg bg-slate-950/50 p-2.5 border border-slate-900  rounded text-left flex-1 min-h-0 flex flex-col justify-between">
                      <div className="text-[9px] text-slate-500 uppercase tracking-widest font-black flex items-center gap-1.5 mb-1.5">
                        <Trophy className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        <span>戰役英雄榜 (TOP TACTICAL AGENTS)</span>
                      </div>
                      <div className="space-y-1 overflow-y-auto max-h-24 pr-1 scrollbar-none">
                        {debrief.mvpList.length === 0 ? (
                          <div className="text-[9px] text-slate-600 text-center py-2">本場戰役尚無特工進行活動。</div>
                        ) : (
                          debrief.mvpList.map((hero, idx) => {
                            const isHeroRed = hero.faction === "red";
                            const specBorder = isHeroRed ? "border-red-950/60 bg-red-950/5 text-red-400" : "border-blue-950/60 bg-blue-950/5 text-blue-400";
                            return (
                              <div key={hero.callsign} className={`flex items-center justify-between p-1 px-2 rounded-sm border ${specBorder} text-[9px]`}>
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-mono font-bold ${idx === 0 ? "text-yellow-500" : "text-slate-400"}`}>[{idx + 1}]</span>
                                  <span className="font-bold text-slate-200">{hero.callsign}</span>
                                  <span className="text-[7.5px] opacity-75 font-mono">({isHeroRed ? "紅" : "藍"})</span>
                                </div>
                                <div className="flex gap-3 text-[8.5px] font-mono">
                                  <span>奪旗: <span className="text-white font-bold">{hero.scans}次</span></span>
                                  <span>重生: <span className="text-emerald-400">{hero.heals}次</span></span>
                                  <span>陣亡: <span className="text-rose-500">{hero.hits}次</span></span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Restart Command */}
                    <div className="mt-3 flex gap-2 w-full justify-center shrink-0">
                      <button
                        onClick={handleResetSession}
                        className="px-6 py-1.5 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-black font-extrabold uppercase tracking-wider text-[10px] rounded transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>重整姿態 / 開始下一場戰役</span>
                      </button>
                    </div>

                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="flex-1 border-2 border-slate-800 relative bg-slate-900/20 overflow-hidden flex flex-col justify-between p-4 xl:p-5">
              
              {/* Grid dot indicator overlay strictly matching Elegant Dark */}
              <div 
                className="absolute inset-0 opacity-10 pointer-events-none" 
                style={{ backgroundImage: "radial-gradient(circle, #0891b2 1px, transparent 1px)", backgroundSize: "20px 20px" }}
              />
              
              {/* Scoreboard Info bar */}
              <div className="relative z-10 flex justify-between items-center text-[10px] text-slate-500 border-b border-slate-800 pb-2 shrink-0">
                <span className="tracking-widest uppercase flex items-center gap-1.5 font-bold">
                  <span className={`inline-block w-2 h-2 rounded-full ${session?.status === "battle" ? "bg-red-500 animate-ping" : "bg-slate-700"}`}></span>
                  <span>TACTICAL MATRIX CENTER</span>
                </span>
                <span className="text-cyan-400 font-bold">MODE: ENHANCED DIRECTIVES</span>
              </div>

              {session?.status === "battle" && (
                <div className="relative z-10 bg-red-950/40 border border-red-900/60 text-red-400 text-[10px] py-1 px-3 flex items-center justify-between animate-pulse">
                  <span className="font-bold">🚨 LIVE WARFARE ENGAGEMENT PROTOCOLS ACTIVE</span>
                  <span className="font-mono text-[8px] tracking-widest font-black text-red-500">LEVEL 4 ALARM</span>
                </div>
              )}

              {/* Scores Layout */}
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-3">
                <div className="flex justify-between w-full items-center max-w-lg mb-1">
                  
                  {/* RED SIDE */}
                  <div className={`text-center group p-3 px-4 rounded border transition-all ${
                    session?.status === "battle" 
                      ? "border-red-500/50 bg-red-950/20 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse" 
                      : "border-slate-800/80 bg-slate-950"
                  }`}>
                    <div className="text-red-500 text-[11px] tracking-[0.3em] font-bold mb-2">RED FACTION</div>
                    <div className="text-6xl md:text-7xl font-black text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all">
                      {session ? String(session.redScore).padStart(2, "0") : "00"}
                    </div>
                    
                    {/* +/- buttons */}
                    <div className="mt-2 flex items-center justify-center gap-2 opacity-80 hover:opacity-100">
                      <button
                        onClick={() => adjustScore("red", -1)}
                        className="w-6 h-6 rounded bg-slate-950 border border-red-900/60 text-red-500 hover:bg-red-950 flex items-center justify-center text-xs transition-colors cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-[9px] text-slate-600">JUDGE</span>
                      <button
                        onClick={() => adjustScore("red", 1)}
                        className="w-6 h-6 rounded bg-slate-950 border border-red-900/60 text-red-500 hover:bg-red-950 flex items-center justify-center text-xs transition-colors cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="text-slate-700 text-3xl font-black italic tracking-widest px-4 select-none">VS</div>

                  {/* BLUE SIDE */}
                  <div className={`text-center group p-3 px-4 rounded border transition-all ${
                    session?.status === "battle" 
                      ? "border-blue-500/50 bg-blue-950/20 shadow-[0_0_20px_rgba(59,130,246,0.3)] animate-pulse" 
                      : "border-slate-800/80 bg-slate-950"
                  }`}>
                    <div className="text-blue-500 text-[11px] tracking-[0.3em] font-bold mb-2">BLUE FACTION</div>
                    <div className="text-6xl md:text-7xl font-black text-blue-500 drop-shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all">
                      {session ? String(session.blueScore).padStart(2, "0") : "00"}
                    </div>

                    {/* +/- buttons */}
                    <div className="mt-2 flex items-center justify-center gap-2 opacity-80 hover:opacity-100">
                      <button
                        onClick={() => adjustScore("blue", -1)}
                        className="w-6 h-6 rounded bg-slate-950 border border-blue-900/60 text-blue-400 hover:bg-blue-950 flex items-center justify-center text-xs transition-colors cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-[9px] text-slate-600">JUDGE</span>
                      <button
                        onClick={() => adjustScore("blue", 1)}
                        className="w-6 h-6 rounded bg-slate-950 border border-blue-900/60 text-blue-400 hover:bg-blue-950 flex items-center justify-center text-xs transition-colors cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                </div>

                {/* Custom adjustable timer when waiting, else standard countdown */}
                {session?.status === "waiting" ? (
                  <div className="mt-2 flex flex-col items-center w-full max-w-sm bg-slate-950/90 border border-slate-800/80 p-2.5 rounded text-center shrink-0">
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">⏱️ 設定戰役作戰時長 (Timer Duration)</div>
                    <div className="flex gap-2 items-center justify-center w-full">
                      <input
                        type="number"
                        min="10"
                        max="3600"
                        value={session ? session.duration : 360}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 360;
                          handleSetDuration(val);
                        }}
                        className="w-20 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-center text-cyan-400 font-mono font-bold focus:outline-none focus:border-cyan-500 select-all"
                        placeholder="秒數"
                      />
                      <span className="text-[10px] text-slate-500">秒 或是：</span>
                      <div className="flex gap-1">
                        {[60, 180, 300, 600].map((preset) => (
                          <button
                            key={preset}
                            onClick={() => {
                              playClick();
                              handleSetDuration(preset);
                            }}
                            className={`text-[9px] font-mono font-bold px-2 py-0.5 border rounded-sm transition-all cursor-pointer ${
                              session?.duration === preset
                                ? "bg-cyan-500 text-black border-cyan-400"
                                : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400"
                            }`}
                          >
                            {preset / 60}M
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-[8px] text-slate-500 mt-1.5 uppercase font-mono">
                      目前時長: {session ? formatTimer(session.duration) : "06:00"} ({session?.duration || 360}S)
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-col items-center shrink-0">
                    <div className="text-[10px] text-slate-500 tracking-[0.2em] uppercase mb-1">REMAINING OPERATION WINDOW</div>
                    <div className="text-4 flex text-4xl font-black text-cyan-400 tracking-wider drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                      {session ? formatTimer(session.timeRemaining) : "00:00"}
                    </div>
                  </div>
                )}
              </div>

              {/* Realtime score trend analyzer */}
              <div className="relative z-10 border border-slate-800 bg-slate-950/80 p-2.5 rounded shrink-0 h-32 flex flex-col justify-between mb-1.5">
                <div className="flex justify-between items-center text-[8.5px] uppercase text-slate-500 border-b border-slate-900 pb-1 mb-1 font-bold">
                  <span className="tracking-wider">雙方積分趨勢實時分析儀</span>
                  <span className="text-cyan-400 animate-pulse">● SW_TREND: DYNAMIC</span>
                </div>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scoreTrend} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#121824" />
                      <XAxis dataKey="time" stroke="#475569" fontSize={8} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={8} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '4px', fontSize: '9px', fontFamily: 'monospace' }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '8px', bottom: -5 }} />
                      <Line type="monotone" dataKey="red" stroke="#ef4444" name="紅隊 (Red)" strokeWidth={2.5} activeDot={{ r: 4 }} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="blue" stroke="#3b82f6" name="藍隊 (Blue)" strokeWidth={2.5} activeDot={{ r: 4 }} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Lower Objective summary card */}
              <div className="relative z-10 w-full bg-slate-800/40 p-2.5 border-t border-slate-700/60 shrink-0">
                <div className="text-center text-[10px] xl:text-[11px] text-slate-400 uppercase tracking-widest font-bold">
                  Objective: Capture Enemy Team Flag QR To Score Points
                </div>
                <div className="mt-1 flex justify-center gap-2">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]"></div>
                  <div className="w-2.5 h-2.5 bg-cyan-500 rounded-full shadow-[0_0_8px_#06b6d4] animate-ping"></div>
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6]"></div>
                </div>
              </div>

            </div>
          )}

          {/* Bottom Bases Zone layout strictly as styled */}
          <div className="min-h-[4rem] py-3 border border-slate-800 bg-cyan-500/5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 shrink-0 text-[10px] px-4">
             <div className="flex items-center gap-2">
                <span className="text-slate-500 uppercase font-black">BASE_A (紅隊司令部):</span>
                <span className="text-green-500 font-bold uppercase tracking-wider">SECURE</span>
             </div>
             <div className="hidden md:block w-px h-5 bg-slate-800" />
             <div className="flex items-center gap-2">
                <span className="text-slate-500 uppercase font-black">BASE_B (藍隊大本營):</span>
                <span className="text-orange-500 font-bold uppercase tracking-wider animate-pulse">UNDER FIRE</span>
             </div>
             <div className="hidden md:block w-px h-5 bg-slate-800" />
             <div className="flex items-center gap-2">
                <span className="text-slate-500 uppercase font-black">MEDIC_ZONE (中立區):</span>
                <span className="text-blue-500 font-bold uppercase tracking-wider">STANDBY</span>
             </div>
          </div>
        </section>

        {/* Right Section: Combat Logs */}
        <aside className="col-span-1 lg:col-span-3 border border-slate-800 bg-slate-900/30 p-3 flex flex-col min-h-0 h-full">
          <div className="text-[10px] uppercase text-slate-500 mb-3 border-b border-slate-800 pb-1 flex justify-between shrink-0">
            <span>Live Combat Logs</span>
            <span className="text-cyan-700 font-bold">DES3 ENCRYPTED</span>
          </div>

          {/* Scrolling combat messages */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-[10px] text-slate-400 font-mono scrollbar-thin scrollbar-thumb-slate-800">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 py-12 gap-2">
                <span className="animate-pulse">●</span>
                <span>[戰事寂靜]</span>
                <span className="text-[9px]">等待特工觸發掃集行為...</span>
              </div>
            ) : (
              logs.map((log, index) => {
                let borderTheme = "border-slate-500";
                let textCol = "text-slate-300";
                let logBg = "bg-transparent";
                let typeIcon = <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;

                const type = log.type || "system";
                const isKill = type === "kill" || log.message.includes("擊殺") || log.message.includes("淘汰");
                const isCapture = type === "capture" || log.message.includes("佔領") || log.message.includes("奪取");
                const isRevive = type === "revive" || log.message.includes("復活");
                const isSupply = type === "supply" || log.message.includes("補給");

                if (isKill) {
                  borderTheme = "border-rose-500";
                  textCol = "text-rose-400";
                  typeIcon = <Skull className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-pulse" />;
                } else if (isCapture) {
                  borderTheme = "border-amber-400";
                  textCol = "text-amber-400";
                  typeIcon = <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
                } else if (isRevive) {
                  borderTheme = "border-emerald-400";
                  textCol = "text-emerald-400";
                  typeIcon = <Heart className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
                } else if (isSupply) {
                  borderTheme = "border-cyan-400";
                  textCol = "text-cyan-400";
                  typeIcon = <Award className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
                } else {
                  if (log.faction === "red") {
                    borderTheme = "border-red-500";
                    textCol = "text-red-400";
                  } else if (log.faction === "blue") {
                    borderTheme = "border-blue-500";
                    textCol = "text-blue-400";
                  } else {
                    borderTheme = "border-slate-700";
                    textCol = "text-slate-400";
                  }
                }

                // If this is the currently highlighted player
                const isRowHighlighted = highlightedPlayer && (
                  highlightedPlayer === log.callsign || 
                  log.message.includes(highlightedPlayer)
                );

                if (isRowHighlighted) {
                  logBg = "bg-yellow-400/10 ring-1 ring-yellow-400/40";
                }

                const timeStr = new Date(log.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                return (
                  <div 
                    key={index} 
                    onClick={() => {
                      playClick();
                      if (highlightedPlayer === log.callsign) {
                        setHighlightedPlayer(null);
                      } else {
                        setHighlightedPlayer(log.callsign);
                      }
                    }}
                    className={`border-l-2 ${borderTheme} ${logBg} pl-2 py-1 flex items-start gap-2 cursor-pointer hover:bg-slate-800/40 transition-colors rounded-sm`}
                    title={`點擊以在特工名單高亮特工: ${log.callsign}`}
                  >
                    {typeIcon}
                    <div className="flex-1 leading-snug">
                      <span className="text-slate-600 mr-1 text-[8px]">[{timeStr}]</span>{" "}
                      <span className={`font-bold ${textCol}`}>{log.callsign}</span>{" "}
                      <span className="text-slate-200">{log.message}</span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={logEndRef} />
          </div>

          <div className="pt-2 border-t border-slate-800 text-[9px] text-slate-600 shrink-0 text-right uppercase">
            Captured Records: {logs.length}
          </div>
        </aside>

      </main>

      {/* Control Footer */}
      <footer className="h-16 mt-4 flex items-center gap-4 shrink-0 relative z-20">
        <button 
          id="cmd-execute-start-btn"
          onClick={startBriefingAndBattle}
          disabled={session?.status === "battle" || isSpeaking}
          className={`h-full px-8 font-bold transition-all uppercase tracking-widest text-xs flex items-center gap-2 ${
            session?.status === "battle" || isSpeaking
              ? "bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed"
              : "bg-cyan-600 text-black hover:bg-cyan-400 active:scale-95 cursor-pointer"
          }`}
        >
          {isSpeaking ? "Broadcasting..." : "Execute Mission (開始作戰)"}
        </button>

        <button 
          id="cmd-abort-reset-btn"
          onClick={handleResetSession}
          className="h-full px-8 border border-red-900 text-red-500 font-bold hover:bg-red-500/10 transition-colors uppercase tracking-widest text-xs active:scale-95"
        >
          Abort / Reset (重設戰局)
        </button>

        <div className="flex-1"></div>

        {/* Floating helper or Admin control tools strictly aligned to design specs */}
        <div className="flex gap-2 h-full">
          <div 
            onClick={() => {
              playClick();
              onShowQR();
            }}
            className="w-12 h-full bg-slate-900 border border-slate-800 flex items-center justify-center group cursor-pointer hover:border-cyan-500 transition-colors pr-0.5 rounded-sm"
            title="開啟戰術 QR 生成面板"
          >
            <div className="w-5 h-5 border-2 border-slate-700 group-hover:border-cyan-500 transition-colors rounded-sm flex items-center justify-center text-[10px] text-slate-500 font-bold group-hover:text-cyan-400">QR</div>
          </div>
          <div className="px-4 h-full bg-slate-900 border border-slate-800 flex flex-col justify-center rounded-sm">
            <span className="text-[9px] text-slate-500 uppercase font-black">Admin Role</span>
            <span className="text-[11px] text-cyan-500 font-bold">OVERWATCH_CENTER</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
