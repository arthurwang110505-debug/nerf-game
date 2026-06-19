/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import { 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  collection, 
  addDoc,
  getDoc
} from "firebase/firestore";
import { 
  db, 
  appId, 
  auth, 
  initializeAuth, 
  OperationType, 
  handleFirestoreError 
} from "../lib/firebase";
import { PlayerState, GameSession, GameLog, PlayerStatus } from "../types";
import { Html5QrcodeScanner } from "html5-qrcode";
import { 
  playClick, 
  playJoin, 
  playHit, 
  playMedic, 
  playSupply, 
  playCapture, 
  playBeep 
} from "../lib/audio";
import { 
  Camera, 
  Check, 
  ShieldAlert, 
  Flame, 
  Scan, 
  User, 
  Award, 
  Crosshair, 
  Activity, 
  Heart, 
  Power, 
  Sparkles, 
  VolumeX, 
  CheckCircle,
  HelpCircle,
  ChevronRight
} from "lucide-react";
import { globalEventBus, TacticalEvents } from "../lib/eventBus";

interface PlayerTerminalProps {
  onShowQR: () => void;
}

export default function PlayerTerminal({ onShowQR }: PlayerTerminalProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [callsign, setCallsign] = useState("");
  const [faction, setFaction] = useState<"red" | "blue">("red");

  // Camera Scanner Fields
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [activeBuff, setActiveBuff] = useState<string | null>(null);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Initialize Firebase Auth & read user profile
  useEffect(() => {
    const startup = async () => {
      try {
        setLoading(true);
        const user = await initializeAuth();
        setCurrentUser(user);

        // Listen to active game sesion so players have live HUD stats
        const sessionDocRef = doc(db, "artifacts", appId, "public", "data", "game_sessions", "active_session");
        onSnapshot(sessionDocRef, (snap) => {
          if (snap.exists()) {
            setSession(snap.data() as GameSession);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, "active_session");
        });

        // Listen to player profile
        const playerDocRef = doc(db, "artifacts", appId, "public", "data", "players", user.uid);
        onSnapshot(playerDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as PlayerState;
            setPlayerState(data);
            setIsRegistered(true);
            setCallsign(data.callsign);
            setFaction(data.faction);
          } else {
            setIsRegistered(false);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `players/${user.uid}`);
          setLoading(false);
        });
      } catch (err) {
        console.error("Failed to boot Player terminal:", err);
        setLoading(false);
      }
    };

    startup();
  }, []);

  // Handle local 1s interval counts if player state is "respawning"
  useEffect(() => {
    if (!playerState || playerState.status !== "respawning" || !currentUser) return;

    const interval = setInterval(async () => {
      const nextTimer = playerState.respawnTimer - 1;

      const playerDocRef = doc(db, "artifacts", appId, "public", "data", "players", currentUser.uid);
      if (nextTimer <= 0) {
        clearInterval(interval);
        // Revive completed!
        try {
          await updateDoc(playerDocRef, {
            status: "active",
            respawnTimer: 0,
            lastActive: Date.now()
          });

          // Log revival
          await addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
            timestamp: Date.now(),
            callsign: playerState.callsign,
            faction: playerState.faction,
            message: `【醫療重組完畢】特工 ${playerState.callsign} 已重生復活，重返戰場！`,
            type: "medic"
          });
          playMedic();
        } catch (e) {
          console.error("Revival write failed", e);
        }
      } else {
        // Tick timer update
        try {
          await updateDoc(playerDocRef, {
            respawnTimer: nextTimer,
            lastActive: Date.now()
          });
          playBeep(400, 0.05, "sine");
        } catch (e) {
          console.error(e);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [playerState?.status, playerState?.respawnTimer]);

  // QR Code camera initialization / tearDown
  useEffect(() => {
    if (showScanner) {
      // Start camera rendering
      setTimeout(() => {
        try {
          const qrScanner = new Html5QrcodeScanner(
            "camera-reader-element",
            { 
              fps: 12, 
              qrbox: { width: 230, height: 230 },
              aspectRatio: 1.0,
              showTorchButtonIfSupported: true,
            },
            /* verbose= */ false
          );

          qrScanner.render(
            (decodedText) => {
              // Successfully scanned something!
              handleQRCodeCaptured(decodedText);
              qrScanner.clear().catch(e => console.error("Scanner clear fail", e));
              setShowScanner(false);
            },
            (errorMessage) => {
              // Silent skip regular frames scan misses to prevent spam log
            }
          );
          scannerRef.current = qrScanner;
        } catch (e: any) {
          console.error("Camera construct check failed:", e);
          setScannerError("相機模組初始化失敗，可能無權限或已被其他程式佔用。請使用模擬器測試。");
        }
      }, 300);
    } else {
      // Clean up scanning
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch(err => console.error("Tear down scan", err));
          scannerRef.current = null;
        } catch(e) {
          // ignore already cleared
        }
      }
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch(err => console.error("Tear down scan", err));
        } catch(e) {}
      }
    };
  }, [showScanner]);

  // Player Registration Trigger
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    if (!currentUser) return;

    const trimmed = callsign.trim();
    if (!trimmed) {
      alert("請輸入特工代號 Callsign！");
      return;
    }

    const playerDocRef = doc(db, "artifacts", appId, "public", "data", "players", currentUser.uid);
    try {
      const record: PlayerState = {
        uid: currentUser.uid,
        callsign: trimmed,
        faction: faction,
        status: "active",
        respawnTimer: 0,
        lastActive: Date.now()
      };

      await setDoc(playerDocRef, record);

      // Write a beautiful arrival log
      await addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
        timestamp: Date.now(),
        callsign: trimmed,
        faction: faction,
        message: `【特工編入】代號 "${trimmed}" 已向「${faction === "red" ? "紅隊" : "藍隊"}」分部報到入伍！防線已鞏固。`,
        type: "join"
      });

      // Emit local Event Bus signal
      globalEventBus.emit(TacticalEvents.PLAYER_STATE_CHANGED, {
        callsign: trimmed,
        faction: faction,
        status: "active"
      });

      playJoin();
      setIsRegistered(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `players/${currentUser.uid}`);
    }
  };

  // Report self dead / hit
  const handleDeclareHit = async () => {
    playClick();
    if (!playerState || !currentUser) return;
    if (playerState.status !== "active") return;

    if (!confirm("⚠️ 戰機通報：您真的在交火中被 NERF 軟彈擊中，並宣告陣亡嗎？")) return;

    const playerDocRef = doc(db, "artifacts", appId, "public", "data", "players", currentUser.uid);
    try {
      await updateDoc(playerDocRef, {
        status: "dead",
        respawnTimer: 0,
        lastActive: Date.now()
      });

      // Write log
      await addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
        timestamp: Date.now(),
        callsign: playerState.callsign,
        faction: playerState.faction,
        message: `💥【特工大破】特工 ${playerState.callsign} 回報被軟彈射中！已被迫陣亡。請立即前往中立醫療區掃描復活二維碼。`,
        type: "hit"
      });

      // Emit local Event Bus event
      globalEventBus.emit(TacticalEvents.PLAYER_STATE_CHANGED, {
        callsign: playerState.callsign,
        faction: playerState.faction,
        status: "dead"
      });

      playHit();
    } catch (e) {
      console.error(e);
    }
  };

  // Execute actual scanned QR code action
  const handleQRCodeCaptured = async (code: string) => {
    if (!playerState || !currentUser) return;
    const sessionDocRef = doc(db, "artifacts", appId, "public", "data", "game_sessions", "active_session");

    setScanResult(code);
    let successMessage = "";
    let isError = false;

    try {
      // 1. Enemy Flag Scored
      if (code === "nerf-ctf-red-flag" || code === "nerf-ctf-blue-flag") {
        if (session?.status !== "battle") {
          alert("戰役未打響，無法在非作戰時間搶奪基地旗幟！");
          return;
        }

        const isRedFlag = code === "nerf-ctf-red-flag";
        const enemyFaction = isRedFlag ? "red" : "blue";
        
        // Checking if scan matches player's own flag
        if (playerState.faction === enemyFaction) {
          isError = true;
          playHit(); // play error
          alert(`⚔️ 防線自誤：這是您自己陣營的基地旗幟！您必須跨越火線，掃描敵軍「${enemyFaction === "red" ? "藍隊" : "紅隊"}」基地中的旗幟才可得分。`);
          return;
        }

        if (playerState.status !== "active") {
          isError = true;
          alert("❌ 幽靈奪旗無效：您目前處於陣亡或重生狀態，無法搬運旗幟！請先去醫療箱復活。");
          return;
        }

        // Add 10 points to scanner's faction score
        const points = activeBuff === "double" ? 20 : 10;
        const freshSessionSnap = await getDoc(sessionDocRef);
        if (freshSessionSnap.exists()) {
          const curr = freshSessionSnap.data() as GameSession;
          const nextRed = playerState.faction === "red" ? curr.redScore + points : curr.redScore;
          const nextBlue = playerState.faction === "blue" ? curr.blueScore + points : curr.blueScore;
          
          await updateDoc(sessionDocRef, {
            redScore: nextRed,
            blueScore: nextBlue
          });
        }

        successMessage = `🔥【紅利奪標】特工 ${playerState.callsign} 突破包圍網，掃描了敵方的戰地旗幟！${playerState.faction === "red" ? "紅隊" : "藍隊"}斬獲 ${points} 積分！`;
        const logData = {
          timestamp: Date.now(),
          callsign: playerState.callsign,
          faction: playerState.faction,
          message: successMessage,
          type: "scan"
        };
        await addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), logData);

        // Emit through local Event Bus
        globalEventBus.emit(TacticalEvents.QR_SCANNED, {
          ...logData,
          code
        });

        playCapture();
        alert(`🎉 任務大成功！奪旗成功為我軍斬獲了 ${points} 分！`);
        setActiveBuff(null); // Clear buff on flag scoring

      // 2. Medic Healing Station
      } else if (code === "nerf-item-medic") {
        if (playerState.status === "active") {
          alert("💚 特工狀態無恙：您目前處於健康作戰狀態，無須進行醫療重組！把資源留給隊友。");
          return;
        }

        // Enter 10s countdown respawn state
        const playerDocRef = doc(db, "artifacts", appId, "public", "data", "players", currentUser.uid);
        await updateDoc(playerDocRef, {
          status: "respawning",
          respawnTimer: 10,
          lastActive: Date.now()
        });

        successMessage = `💚【戰地救援】特工 ${playerState.callsign} 抵達重組醫療站，裝備已接入重組通訊，開始罰站 10 秒計時重生...`;
        await addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
          timestamp: Date.now(),
          callsign: playerState.callsign,
          faction: playerState.faction,
          message: successMessage,
          type: "medic"
        });

        playMedic();

      // 3. Supply Crates
      } else if (code === "nerf-item-supply") {
        if (playerState.status !== "active") {
          alert("❌ 無法接收補給：陣亡狀態無法拾取戰區物資包！請先去往復活點。");
          return;
        }

        // Select a random military buff
        const buffs = [
          { key: "shield", label: "「重裝離子護盾」 (免疫下一次擊中傷害！)", log: "獲得了「離子防禦護盾」，戰力大增！" },
          { key: "double", label: "「雙倍奪旗晶片」 (下一奪旗掃描得分翻倍！)", log: "啟用了「雙倍得分晶片」，正在朝敵軍大本營進攻！" },
          { key: "ammo", label: "「特種高爆彈匣」 (高爆彈附魔狀態！)", log: "搜刮到了「特種高爆彈匣」重裝完成！" }
        ];

        const selected = buffs[Math.floor(Math.random() * buffs.length)];
        setActiveBuff(selected.key);

        successMessage = `🎁【空投捕獲】特工 ${playerState.callsign} 搜刮了戰區物資箱！${selected.log}`;
        await addDoc(collection(db, "artifacts", appId, "public", "data", "game_logs"), {
          timestamp: Date.now(),
          callsign: playerState.callsign,
          faction: playerState.faction,
          message: successMessage,
          type: "supply"
        });

        playSupply();
        alert(`🎁 空投捕獲成功！\n您啟動了：${selected.label}`);

      } else {
        alert(`⚠️ 未知的戰術二維碼: "${code}"\n請在本系統產生的 QR Generator 中選用合法合規的二維碼進行掃集。`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 w-full bg-slate-950 flex flex-col items-center justify-center text-cyan-400 font-mono text-xs gap-3">
        <Activity className="w-8 h-8 text-cyan-500 animate-spin" />
        <span className="tracking-widest">CONNECTING TO MIL-NET DATA...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-slate-950 p-4 font-mono text-slate-200 select-none flex flex-col justify-between overflow-y-auto max-w-md mx-auto relative border-x border-slate-900">
      
      {/* HEADER SECTION */}
      <div className="border-b border-cyan-900/50 pb-3 mb-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-cyan-500/80 flex items-center justify-center rounded-sm">
            <Crosshair className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-cyan-400 tracking-wider">TACTICAL MOBILE CLIENT</h1>
            <p className="text-[8px] text-slate-500 font-mono">SEC_PORT: {appId.substring(0, 8).toUpperCase()}</p>
          </div>
        </div>

        {isRegistered && (
          <button
            onClick={() => {
              playClick();
              if (confirm("確定要登出並重新註冊您的特工身份嗎？")) {
                const docRef = doc(db, "artifacts", appId, "public", "data", "players", currentUser?.uid);
                setDoc(docRef, {}).then(() => {
                  setIsRegistered(false);
                  setCallsign("");
                });
              }
            }}
            className="p-1 px-2.5 bg-slate-900 border border-slate-750 text-red-400 hover:text-red-350 rounded text-[9px] hover:bg-slate-850 flex items-center gap-1 transition-all"
          >
            <Power className="w-3 h-3 text-red-500" />
            <span>重新連線</span>
          </button>
        )}
      </div>

      {session && session.status === "finished" && (
        <div className="mb-4 p-3 bg-cyan-950/20 border border-cyan-800 text-cyan-400 text-xxs rounded text-center font-sans">
          🏆 <strong>戰役已圓滿結束！</strong><br />
          紅隊 {session.redScore} 分 VS {session.blueScore} 藍隊 分
        </div>
      )}

      {/* CORE SCREEN */}
      <div className="flex-1 flex flex-col justify-center my-2">
        {!isRegistered ? (
          /* REGISTRATION FORM (NOT REGISTERED) */
          <form onSubmit={handleRegister} className="space-y-4 bg-slate-900/40 p-5 border border-slate-850 rounded-lg">
            <div className="text-center space-y-1 pb-2 border-b border-slate-850">
              <h2 className="text-sm font-bold tracking-widest text-cyan-400">特工報到登記處 // SOLDIER CHECKIN</h2>
              <p className="text-[10px] text-slate-400 leading-normal">
                請登入您的特工代號、選擇您的所屬作戰陣營，分部裝備。
              </p>
            </div>

            {/* Callsign Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-cyan-500" />
                特工戰場代號 (Callsign):
              </label>
              <input
                type="text"
                maxLength={14}
                required
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="例如: Ghost, Shadow, Maverick..."
                className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded p-2.5 text-xs text-cyan-400 focus:outline-none transition-colors"
              />
            </div>

            {/* Faction Alliance的选择 */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                所屬作戰部群 (Faction):
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { playClick(); setFaction("red"); }}
                  className={`py-3 rounded border font-bold text-xxs transition-all ${
                    faction === "red"
                      ? "bg-red-950/60 text-red-400 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]"
                      : "bg-black/60 text-gray-500 border-slate-900 hover:text-gray-400"
                  }`}
                >
                  🔴 紅隊 (Red Faction)
                </button>

                <button
                  type="button"
                  onClick={() => { playClick(); setFaction("blue"); }}
                  className={`py-3 rounded border font-bold text-xxs transition-all ${
                    faction === "blue"
                      ? "bg-blue-950/60 text-blue-300 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.25)]"
                      : "bg-black/60 text-gray-500 border-slate-900 hover:text-gray-400"
                  }`}
                >
                  🔵 藍隊 (Blue Faction)
                </button>
              </div>
            </div>

            {/* Consent Notice */}
            <p className="text-[9px] text-slate-600 leading-normal">
              [通訊協定安全聲明] 本設備登錄成功後將同步連接至大螢幕主控台，所有的射擊回置與物資採集均會實時公開播報。
            </p>

            {/* Checkin submit */}
            <button
              type="submit"
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-black font-extrabold rounded-md text-xs tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-[0_4px_16px_rgba(8,145,178,0.2)]"
            >
              <Check className="w-4 h-4 text-black stroke-[3]" />
              分部入伍，重裝上陣！
            </button>
          </form>
        ) : (
          /* ACTIVE USER COMBAT HUD (REGISTERED) */
          <div className="space-y-4">
            
            {/* Player Banner Status Card */}
            <div className={`p-4 rounded-xl border relative overflow-hidden bg-gradient-to-r ${
              playerState?.faction === "red"
                ? "border-red-500/40 from-red-950/30 to-slate-900"
                : "border-blue-500/40 from-blue-950/30 to-slate-900"
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${playerState?.faction === "red" ? "bg-red-500 animate-pulse" : "bg-blue-400 animate-pulse"}`} />
                  <span className="text-xs font-black uppercase text-gray-100">
                    特工: {playerState?.callsign}
                  </span>
                </div>
                <span className={`text-4xs px-2 py-0.5 rounded-full font-sans uppercase font-bold bg-black/60 border ${
                  playerState?.faction === "red" ? "border-red-900 text-red-400" : "border-blue-900 text-blue-400"
                }`}>
                  {playerState?.faction === "red" ? "RED FACTION" : "BLUE FACTION"}
                </span>
              </div>

              {/* Central Life State Indicator */}
              <div className="py-4 text-center">
                <div className="text-5xs text-gray-400 mb-1 leading-normal uppercase">VITAL MONITOR // 特工生命體徵狀態</div>
                
                {playerState?.status === "active" ? (
                  <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-950/40 border border-emerald-500/40 rounded-full text-emerald-400 text-xs font-bold shadow-[0_0_12px_rgba(16,185,129,0.15)] pr-5 select-none">
                    <Heart className="w-4.5 h-4.5 fill-emerald-500 animate-heartbeat shrink-0" />
                    <span>良好，健康作戰中 (ACTIVE)</span>
                  </div>
                ) : playerState?.status === "dead" ? (
                  <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-950/50 border border-red-500/50 rounded-full text-red-500 text-xs font-bold animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.2)] select-none">
                    <ShieldAlert className="w-4.5 h-4.5 text-red-500 shrink-0" />
                    <span>已陣亡 (KILLED IN ACTION)</span>
                  </div>
                ) : (
                  <div className="inline-flex flex-col gap-1 items-center justify-center p-3 bg-amber-950/50 border border-amber-500/50 rounded-lg text-amber-400 text-xs font-bold select-none w-full animate-pulse mr-1">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>戰地救援重組中 (RESPAWNING...)</span>
                    </div>
                    <div className="text-3xl font-black mt-1 font-sans">{playerState?.respawnTimer}s</div>
                    <div className="text-5xs text-amber-500 uppercase">請在醫療站停留重組通訊，請勿隨意離開</div>
                  </div>
                )}
              </div>

              {/* Active Buffs panel */}
              {activeBuff && (
                <div className="mt-2 text-xxs font-sans text-center bg-amber-950/20 border border-amber-800/60 py-1.5 px-3 rounded text-amber-400 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    目前啟用狀態:{" "}
                    <strong>
                      {activeBuff === "shield"
                        ? "量子離子裝甲 (Shield)"
                        : activeBuff === "double"
                        ? "雙倍奪旗卡 (Double Score)"
                        : "特戰快充高爆彈 (Explosive Ammo)"}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            {/* MANUAL OPERATION BUTTONS */}
            <div className="grid grid-cols-1 gap-3">
              {/* HIT DECLARE BUTTON */}
              <button
                maxLength={4}
                onClick={handleDeclareHit}
                disabled={playerState?.status !== "active"}
                className={`py-4 rounded-lg font-bold text-xxs tracking-wider border flex items-center justify-center gap-2.5 transition-all shadow-md mt-1 ${
                  playerState?.status === "active"
                    ? "bg-gradient-to-r from-red-900 to-red-950 hover:from-red-800 hover:to-red-900 text-red-100 border-red-700/60 hover:shadow-[0_0_16px_rgba(239,68,68,0.25)] active:scale-95"
                    : "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed select-none"
                }`}
              >
                <ShieldAlert className="w-5 h-5 shrink-0 text-red-400" />
                <span>🚨 我中彈了！(Declare HIT / KIA)</span>
              </button>

              {/* CAMERA SCANNER ACTIVATE */}
              {showScanner ? (
                <div className="bg-gray-900 border border-cyan-500 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-800 text-xxs">
                    <span className="text-cyan-400 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" />
                      戰地攝像鏡頭讀取中
                    </span>
                    <button
                      onClick={() => { playClick(); setShowScanner(false); }}
                      className="text-4xs px-2 py-0.5 bg-gray-950 border border-gray-800 hover:text-white rounded"
                    >
                      關閉相機
                    </button>
                  </div>

                  {/* QR Core viewport reader container */}
                  <div className="overflow-hidden rounded bg-black flex items-center justify-center">
                    <div id="camera-reader-element" className="w-full max-w-[280px]" />
                  </div>

                  {scannerError && (
                    <p className="text-5xs text-red-400 text-center uppercase py-1 leading-normal">
                      {scannerError}
                    </p>
                  )}
                  
                  <p className="text-5xs text-gray-500 text-center leading-normal">
                    [操作指引] 將攝像頭對準戰俘旗幟、醫療站或空投資源 QR Code，系統自動解碼同步大螢幕。
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => { playClick(); setShowScanner(true); }}
                  className="py-4 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black rounded-lg text-xxs tracking-widest flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer hover:shadow-[0_0_20px_rgba(6,182,212,0.45)] active:scale-95 transition-all"
                >
                  <Scan className="w-5 h-5 text-slate-950 stroke-[3]" />
                  <span>打開戰術掃描器 // SCAN OBJECT</span>
                </button>
              )}
            </div>

            {/* SIMULATED TESTING TOOLBOX (Crucial for sandbox environments) */}
            <div className="p-3 bg-gray-900/40 border border-slate-800 rounded-lg space-y-2">
              <div className="flex justify-between items-center pb-1 border-b border-gray-800 text-4xs">
                <span className="text-cyan-500 font-bold">🧪 戰場測試模擬板 // SANDBOX RADAR TEST</span>
                <span className="text-gray-500">Iframe Camera Fallback</span>
              </div>
              <p className="text-5xs text-gray-400 leading-normal">
                [友善提醒] 若您的裝置無相機（如 PC 桌機）或瀏覽器沙盒限制存取鏡頭，請點選以下按鈕模擬裝藥或物資掃描事件：
              </p>

              <div className="grid grid-cols-2 gap-2 text-4xs">
                <button
                  onClick={() => { playClick(); handleQRCodeCaptured("nerf-ctf-red-flag"); }}
                  className="py-2.5 bg-gray-950 hover:bg-slate-800 text-red-400 border border-red-950 hover:border-red-800 rounded flex items-center gap-1 px-2 font-bold cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-3 h-3 text-red-500 shrink-0" />
                  <span>紅守護旗 (Red Flag)</span>
                </button>

                <button
                  onClick={() => { playClick(); handleQRCodeCaptured("nerf-ctf-blue-flag"); }}
                  className="py-2.5 bg-gray-950 hover:bg-slate-800 text-blue-300 border border-blue-950 hover:border-blue-800 rounded flex items-center gap-1 px-2 font-bold cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>藍守護旗 (Blue Flag)</span>
                </button>

                <button
                  onClick={() => { playClick(); handleQRCodeCaptured("nerf-item-medic"); }}
                  className="py-2.5 bg-gray-950 hover:bg-slate-800 text-emerald-400 border border-emerald-950 hover:border-emerald-800 rounded flex items-center gap-1 px-2 font-bold cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span>戰區醫療箱 (Medic)</span>
                </button>

                <button
                  onClick={() => { playClick(); handleQRCodeCaptured("nerf-item-supply"); }}
                  className="py-2.5 bg-gray-950 hover:bg-slate-800 text-amber-400 border border-amber-950 hover:border-amber-800 rounded flex items-center gap-1 px-2 font-bold cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>隨機物資 (Supplies)</span>
                </button>
              </div>

              <div className="pt-1 text-center">
                <button
                  onClick={() => { playClick(); onShowQR(); }}
                  className="text-4xs text-cyan-400 hover:text-cyan-300 underline font-medium"
                >
                  在螢幕上列印或查看道具二維碼 ❯❯
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* FOOTER CODENAME PROTOCOL */}
      <div className="text-4xs text-gray-600 border-t border-slate-900 pt-3 mt-4 text-center">
        WARPED CODENAME // APP ID: {appId.toUpperCase()}<br />
        SECURE TERMINAL — VIBE TACTICAL SYNC © 2026
      </div>
    </div>
  );
}
