/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Clipboard, X, Printer, Check } from "lucide-react";
import { playClick } from "../lib/audio";

interface QRGeneratorProps {
  onClose?: () => void;
}

interface TacticalQR {
  id: string;
  name: string;
  code: string;
  description: string;
  colorBorder: string;
}

export default function QRGenerator({ onClose }: QRGeneratorProps) {
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedQR, setSelectedQR] = useState<TacticalQR | null>(null);

  const tacticalQRs: TacticalQR[] = [
    {
      id: "red-flag",
      name: "紅隊基地旗幟 (Red Flag)",
      code: "nerf-ctf-red-flag",
      description: "藍隊隊員突破防線後，用手機掃描此碼奪取紅隊旗幟，藍隊得 10 分！",
      colorBorder: "border-red-500 text-red-400 bg-red-950/40",
    },
    {
      id: "blue-flag",
      name: "藍隊基地旗幟 (Blue Flag)",
      code: "nerf-ctf-blue-flag",
      description: "紅隊隊員突破防線後，用手機掃描此碼奪取藍隊旗幟，紅隊得 10 分！",
      colorBorder: "border-blue-500 text-blue-400 bg-blue-950/40",
    },
    {
      id: "medic",
      name: "戰場醫療箱 (Medic Box)",
      code: "nerf-item-medic",
      description: "陣亡或受傷特工退回中立區，掃描此碼進入10秒重生狀態，完成後復活！",
      colorBorder: "border-emerald-500 text-emerald-400 bg-emerald-950/40",
    },
    {
      id: "supply",
      name: "隨機補給箱 (Supply Crate)",
      code: "nerf-item-supply",
      description: "搜集特殊戰力補給，隨機獲得「護盾 (Shield)」、「雙倍得分 (Double Points)」等狀態！",
      colorBorder: "border-amber-500 text-amber-400 bg-amber-950/40",
    },
  ];

  useEffect(() => {
    // Generate QR images on load
    const generateAll = async () => {
      const urls: Record<string, string> = {};
      for (const item of tacticalQRs) {
        try {
          const url = await QRCode.toDataURL(item.code, {
            errorCorrectionLevel: "H",
            margin: 2,
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
            width: 300,
          });
          urls[item.id] = url;
        } catch (err) {
          console.error("Failed to generate QR for", item.code, err);
        }
      }
      setQrImages(urls);
    };

    generateAll();
  }, []);

  const handleCopy = (code: string) => {
    playClick();
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePrint = (qr: TacticalQR) => {
    playClick();
    const qrImg = qrImages[qr.id];
    if (!qrImg) return;

    const win = window.open("", "_blank");
    if (!win) {
      alert("請允許開啟彈出視窗以進行列印");
      return;
    }
    win.document.write(`
      <html>
        <head>
          <title>列印戰術二維碼 - ${qr.name}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              text-align: center;
              padding: 40px;
              background-color: white;
              color: black;
            }
            .card {
              border: 3px solid black;
              padding: 20px;
              max-width: 400px;
              margin: 0 auto;
              border-radius: 12px;
            }
            img {
              width: 250px;
              height: 250px;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 5px;
            }
            p {
              font-size: 14px;
              color: #555;
            }
          </style>
        </head>
        <body onload="window.print();">
          <div class="card">
            <h1>NERF 戰術實體道具</h1>
            <h3>${qr.name}</h3>
            <img src="${qrImg}" />
            <p>代碼: <strong>${qr.code}</strong></p>
            <p>${qr.description}</p>
          </div>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div 
        id="qr-console-container"
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-gray-900 border-2 border-cyan-500/50 rounded-xl overflow-hidden shadow-[0_0_25px_rgba(6,182,212,0.15)] font-mono text-gray-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gray-950 border-b border-cyan-500/30">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-cyan-400 animate-pulse" />
            <h2 className="text-lg font-bold tracking-wider text-cyan-400">
              TACTICAL QR GENERATOR / 戰術物資二維碼生成器
            </h2>
          </div>
          {onClose && (
            <button
              id="qr-generator-close-btn"
              onClick={() => {
                playClick();
                onClose();
              }}
              className="p-1 text-gray-400 hover:text-cyan-400 hover:bg-gray-800 rounded transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <p className="text-xs text-gray-400 leading-relaxed max-w-3xl">
            [系統說明] 本系統使用實體 QR Code 來代表戰場資源與旗幟。
            手機端玩家只需打開「戰術掃描器」掃描以下條碼，即可完成奪旗、醫療復活或獲得隨機補給。
            您可以點擊 QR Code 進行放大，或者在電腦端上測試時，直接使用手機掃描螢幕、或將其列印下來貼在實體戰場上。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tacticalQRs.map((qr) => {
              const qrImg = qrImages[qr.id];
              return (
                <div
                  key={qr.id}
                  id={`qr-card-${qr.id}`}
                  className={`flex items-start gap-4 p-4 border rounded-lg transition-all hover:bg-gray-800/50 ${qr.colorBorder}`}
                >
                  <div 
                    onClick={() => {
                      playClick();
                      setSelectedQR(qr);
                    }}
                    className="cursor-pointer bg-white p-1.5 rounded border-2 border-white hover:border-cyan-400 transition-colors shrink-0"
                  >
                    {qrImg ? (
                      <img src={qrImg} alt={qr.name} className="w-24 h-24 object-cover" />
                    ) : (
                      <div className="w-24 h-24 flex items-center justify-center bg-gray-950 text-gray-500 text-xs">
                        載入中...
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 min-w-0">
                    <h3 className="text-sm font-bold truncate text-gray-100">{qr.name}</h3>
                    <p className="text-xxs text-gray-400 line-clamp-2 leading-tight">
                      {qr.description}
                    </p>
                    <div className="text-xxs font-semibold flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded w-fit text-cyan-400/90 border border-cyan-950">
                      <span>值:</span>
                      <span className="font-sans font-bold">{qr.code}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleCopy(qr.code)}
                        className="flex items-center gap-1 text-4xs bg-gray-800 border border-gray-700 hover:border-cyan-400/80 px-2 py-1 rounded hover:text-cyan-300 transition-colors"
                      >
                        {copied === qr.code ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>已複製</span>
                          </>
                        ) : (
                          <>
                            <Clipboard className="w-3 h-3 text-gray-400" />
                            <span>複製值</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handlePrint(qr)}
                        className="flex items-center gap-1 text-4xs bg-gray-800 border border-gray-700 hover:border-cyan-400/80 px-2 py-1 rounded hover:text-cyan-300 transition-colors"
                      >
                        <Printer className="w-3 h-3 text-gray-400" />
                        <span>列印條碼</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Big Dialog for expanded views */}
        {selectedQR && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-md bg-gray-950 border border-cyan-400 p-6 rounded-lg text-center space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                <span className="text-xs text-gray-500 font-sans font-bold">QR DECRYPTION ENGINE</span>
                <button
                  onClick={() => {
                    playClick();
                    setSelectedQR(null);
                  }}
                  className="p-1 hover:bg-gray-800 text-gray-400 hover:text-white rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2 className="text-base font-bold text-cyan-400">{selectedQR.name}</h2>
              <div className="bg-white p-4 rounded-xl mx-auto w-fit border-4 border-cyan-500">
                <img
                  src={qrImages[selectedQR.id]}
                  alt={selectedQR.name}
                  className="w-64 h-64 mx-auto"
                />
              </div>

              <div className="bg-gray-900 border border-gray-800 p-3 rounded text-left">
                <div className="text-xxs font-bold text-gray-400 mb-1">二維碼掃描結果 (值)</div>
                <div className="font-sans font-bold text-white bg-black/60 px-2 py-1 rounded mb-2 select-all text-center">
                  {selectedQR.code}
                </div>
                <p className="text-xs text-gray-300 font-sans leading-relaxed">
                  {selectedQR.description}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    playClick();
                    handlePrint(selectedQR);
                  }}
                  className="flex-1 flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-black font-bold py-2 px-4 rounded text-xs transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  列印這個條碼
                </button>
                <button
                  onClick={() => {
                    playClick();
                    setSelectedQR(null);
                  }}
                  className="flex-1 border border-gray-700 hover:border-gray-500 text-gray-300 py-2 px-4 rounded text-xs transition-colors"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-gray-950 border-t border-cyan-500/20 text-center text-4xs text-gray-500">
          NERF Command Center Platform — Generated items fully support active cameras & static codes scanning.
        </div>
      </div>
    </div>
  );
}
