/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Faction = "red" | "blue" | "system";

export type PlayerStatus = "active" | "dead" | "respawning";

export interface GameSession {
  redScore: number;
  blueScore: number;
  duration: number; // in seconds, default e.g. 600 (10 mins)
  timeRemaining: number;
  status: "waiting" | "battle" | "paused" | "finished";
  updatedAt: number; // timestamp
}

export interface PlayerState {
  uid: string;
  callsign: string;
  faction: "red" | "blue";
  status: PlayerStatus;
  respawnTimer: number; // countdown in seconds if respawning
  lastActive: number; // epoch timestamp
}

export interface GameLog {
  id?: string;
  timestamp: number; // epoch timestamp
  callsign: string;
  faction: Faction;
  message: string;
  type: "join" | "scan" | "hit" | "medic" | "supply" | "system";
}
