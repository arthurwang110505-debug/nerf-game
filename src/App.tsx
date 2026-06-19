/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import ScreenConsole from "./components/ScreenConsole";
import PlayerTerminal from "./components/PlayerTerminal";
import QRGenerator from "./components/QRGenerator";
import { playClick } from "./lib/audio";
import { Monitor, Smartphone, QrCode } from "lucide-react";

export default function App() {
  const [role, setRole] = useState<"screen" | "player">("player");
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    // Detect role on mount from URL parameters
    const params = new URLSearchParams(window.location.search);
    const urlRole = params.get("role");
    if (urlRole === "screen" || urlRole === "player") {
      setRole(urlRole);
    } else {
      // Default parameterless URL to player role
      setRole("player");
    }
  }, []);

  const handleRoleChange = (newRole: "screen" | "player") => {
    playClick();
    setRole(newRole);
    
    // Smoothly push parameter to URL without full page reload
    const url = new URL(window.location.href);
    url.searchParams.set("role", newRole);
    window.history.pushState({}, "", url.toString());
  };

  return (
    <div id="nerf-tactical-root" className="min-h-screen bg-slate-950 flex flex-col relative text-gray-200 selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Sleek Floating Military Dock for Role Toggling & QR Items */}
      <div 
        id="control-dock-bar"
        className="relative z-40 bg-slate-900 border-b border-slate-800 p-2 px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xxs font-mono"
      >
        <div id="sub-title-indicator" className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-gray-400 font-bold tracking-widest text-[10px]">
            NERF TACTICAL SYSTEM CONTROLLER
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* QR Generator launcher button */}
          <button
            id="controller-qr-btn"
            onClick={() => {
              playClick();
              setShowQRModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-400 border border-cyan-800/60 rounded hover:border-cyan-400 transition-all text-xxs font-bold active:scale-95"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>戰術道具二維碼 Generator</span>
          </button>

          {/* Vertical Divider */}
          <div className="w-px h-5 bg-slate-800 hidden sm:block" />

          {/* Switchers */}
          <div className="flex items-center bg-black/60 p-0.5 rounded border border-slate-800">
            <button
              id="switch-player-view-btn"
              onClick={() => handleRoleChange("player")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-all text-xxs font-bold ${
                role === "player"
                  ? "bg-slate-800 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>特工手機端</span>
            </button>

            <button
              id="switch-screen-view-btn"
              onClick={() => handleRoleChange("screen")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-all text-xxs font-bold ${
                role === "screen"
                  ? "bg-slate-800 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>大螢幕主控端</span>
            </button>
          </div>
        </div>
      </div>

      {/* RENDER ACTIVE VIEWPORT */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        {role === "screen" ? (
          <ScreenConsole onShowQR={() => setShowQRModal(true)} />
        ) : (
          <PlayerTerminal onShowQR={() => setShowQRModal(true)} />
        )}
      </div>

      {/* QR GENERATOR MODAL VIEW */}
      {showQRModal && (
        <QRGenerator onClose={() => setShowQRModal(false)} />
      )}
    </div>
  );
}
