// ─── Turn Timer Manager ──────────────────────────────────────────────────────
// Flow per turn:
//   0s  → turn starts
//   20s → WARNING sent to all players ("X is taking too long")
//   10s extra → AUTO PLAY bot makes a move for them
//   If this happens 2x in a row → player marked OFFLINE, permanent bot assigned

class TurnTimerManager {
  constructor(io) {
    this.io = io;
    this.timers = new Map(); // roomCode → timer state
    this.WARN_MS = 20000;    // 20 seconds before warning
    this.EXTRA_MS = 10000;   // 10 extra seconds after warning
  }

  // Start a turn timer for a player
  start(roomCode, playerId, onAutoPlay, onMarkOffline) {
    this.clear(roomCode); // Clear any existing timer

    const state = {
      roomCode,
      playerId,
      warnTimer: null,
      autoTimer: null,
      consecutiveTimeouts: this._getConsecutive(roomCode, playerId)
    };

    // Phase 1: 20s → send warning
    state.warnTimer = setTimeout(() => {
      this.io.to(roomCode).emit('turn_warning', {
        playerId,
        extraSeconds: this.EXTRA_MS / 1000,
        message: `⏰ Extra ${this.EXTRA_MS / 1000}s...`
      });
      console.log(`[Timer] Warning sent for ${playerId} in ${roomCode}`);

      // Phase 2: 10s extra → auto play
      state.autoTimer = setTimeout(() => {
        this._incrementConsecutive(roomCode, playerId);
        const consecutive = this._getConsecutive(roomCode, playerId);
        console.log(`[Timer] Auto-play for ${playerId} (${consecutive}x consecutive)`);

        // Execute auto play
        onAutoPlay(playerId);

        // If 2+ consecutive timeouts → mark offline
        if (consecutive >= 2) {
          console.log(`[Timer] Marking ${playerId} as OFFLINE in ${roomCode}`);
          this._resetConsecutive(roomCode, playerId);
          onMarkOffline(playerId);
        }
      }, this.EXTRA_MS);
    }, this.WARN_MS);

    this.timers.set(roomCode, state);
  }

  // Player acted → clear timer and reset consecutive count
  playerActed(roomCode, playerId) {
    this.clear(roomCode);
    this._resetConsecutive(roomCode, playerId);
  }

  clear(roomCode) {
    const state = this.timers.get(roomCode);
    if (!state) return;
    if (state.warnTimer) clearTimeout(state.warnTimer);
    if (state.autoTimer) clearTimeout(state.autoTimer);
    this.timers.delete(roomCode);
  }

  clearAll() {
    for (const [code] of this.timers) this.clear(code);
  }

  // ── Consecutive timeout tracking ──────────────────────────────────────────
  _key(roomCode, playerId) { return `${roomCode}:${playerId}`; }
  _consecutiveMap = new Map();

  _getConsecutive(roomCode, playerId) {
    return this._consecutiveMap.get(this._key(roomCode, playerId)) || 0;
  }
  _incrementConsecutive(roomCode, playerId) {
    const k = this._key(roomCode, playerId);
    this._consecutiveMap.set(k, (this._consecutiveMap.get(k) || 0) + 1);
  }
  _resetConsecutive(roomCode, playerId) {
    this._consecutiveMap.delete(this._key(roomCode, playerId));
  }
}

module.exports = TurnTimerManager;
