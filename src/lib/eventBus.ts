/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type EventCallback<T = any> = (data: T) => void;

class EventBus {
  private listeners: { [key: string]: EventCallback[] } = {};

  /**
   * Subscribe to a specific event type.
   */
  public on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Return an unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event.
   */
  public off<T = any>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * Publish an event to all subscribers.
   */
  public emit<T = any>(event: string, data: T): void {
    if (!this.listeners[event]) return;
    // Execute all callbacks
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`Error in event listener for "${event}":`, err);
      }
    });
  }
}

export const globalEventBus = new EventBus();

// Structured Combat Event Types
export enum TacticalEvents {
  QR_SCANNED = "QR_SCANNED",
  PLAYER_STATE_CHANGED = "PLAYER_STATE_CHANGED",
  TIMER_EXPIRED = "TIMER_EXPIRED",
  BATTLE_STARTED = "BATTLE_STARTED",
  VOICE_BROADCAST = "VOICE_BROADCAST",
}
