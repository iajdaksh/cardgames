// ─── Player Profile Manager ──────────────────────────────────────────────────
// Stores avatar, name, checkmarks, block/mute/fav lists
// All stored server-side per session (cookie-based, no login)

class PlayerProfileManager {
  constructor() {
    this.profiles = new Map(); // playerId → profile
  }

  getOrCreate(playerId, name) {
    if (!this.profiles.has(playerId)) {
      this.profiles.set(playerId, {
        id: playerId,
        name: name || `Player_${playerId.slice(0, 5)}`,
        avatar: '😀',          // emoji face
        avatarBg: '#2196F3',   // background color
        isOnline: true,
        checkmark: false,
        completedGames: 0,     // consecutive completed games
        abandonedGames: 0,
        gamesPlayed: 0,
        wins: 0,
        blockedPlayers: [],    // playerIds
        mutedPlayers: [],
        favoritePlayers: [],
        joinedAt: Date.now(),
        lastSeen: Date.now()
      });
    }
    const p = this.profiles.get(playerId);
    p.lastSeen = Date.now();
    p.isOnline = true;
    if (name) p.name = name;
    return p;
  }

  get(playerId) {
    return this.profiles.get(playerId);
  }

  setAvatar(playerId, avatar, avatarBg) {
    const p = this.getOrCreate(playerId);
    if (avatar) p.avatar = avatar;
    if (avatarBg) p.avatarBg = avatarBg;
    return p;
  }

  setName(playerId, name) {
    const p = this.getOrCreate(playerId);
    p.name = name.slice(0, 16);
    return p;
  }

  setOnline(playerId, isOnline) {
    const p = this.profiles.get(playerId);
    if (p) { p.isOnline = isOnline; p.lastSeen = Date.now(); }
  }

  // ── Game completion tracking ──────────────────────────────────────────────
  recordGameCompleted(playerId) {
    const p = this.getOrCreate(playerId);
    p.gamesPlayed++;
    p.completedGames++;
    // Earn checkmark after 3 consecutive completions
    if (p.completedGames >= 3) p.checkmark = true;
  }

  recordGameAbandoned(playerId) {
    const p = this.getOrCreate(playerId);
    p.abandonedGames++;
    p.completedGames = 0; // Reset consecutive
    p.checkmark = false;  // Lose checkmark
  }

  recordWin(playerId) {
    const p = this.getOrCreate(playerId);
    p.wins++;
  }

  // ── Social actions ────────────────────────────────────────────────────────
  blockPlayer(byId, targetId) {
    const p = this.getOrCreate(byId);
    if (!p.blockedPlayers.includes(targetId)) p.blockedPlayers.push(targetId);
  }

  unblockPlayer(byId, targetId) {
    const p = this.getOrCreate(byId);
    p.blockedPlayers = p.blockedPlayers.filter(id => id !== targetId);
  }

  mutePlayer(byId, targetId) {
    const p = this.getOrCreate(byId);
    if (!p.mutedPlayers.includes(targetId)) p.mutedPlayers.push(targetId);
  }

  unmutePlayer(byId, targetId) {
    const p = this.getOrCreate(byId);
    p.mutedPlayers = p.mutedPlayers.filter(id => id !== targetId);
  }

  favoritePlayer(byId, targetId) {
    const p = this.getOrCreate(byId);
    if (!p.favoritePlayers.includes(targetId)) p.favoritePlayers.push(targetId);
  }

  unfavoritePlayer(byId, targetId) {
    const p = this.getOrCreate(byId);
    p.favoritePlayers = p.favoritePlayers.filter(id => id !== targetId);
  }

  isBlocked(byId, targetId) {
    const p = this.profiles.get(byId);
    return p ? p.blockedPlayers.includes(targetId) : false;
  }

  isMuted(byId, targetId) {
    const p = this.profiles.get(byId);
    return p ? p.mutedPlayers.includes(targetId) : false;
  }

  // ── Public profile data ───────────────────────────────────────────────────
  getPublicProfile(playerId) {
    const p = this.profiles.get(playerId);
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      avatarBg: p.avatarBg,
      isOnline: p.isOnline,
      checkmark: p.checkmark,
      wins: p.wins,
      gamesPlayed: p.gamesPlayed
    };
  }

  getMyProfile(playerId) {
    const p = this.profiles.get(playerId);
    if (!p) return null;
    return {
      ...this.getPublicProfile(playerId),
      blockedPlayers: p.blockedPlayers,
      mutedPlayers: p.mutedPlayers,
      favoritePlayers: p.favoritePlayers,
      completedGames: p.completedGames
    };
  }
}

// ── Available Avatars ─────────────────────────────────────────────────────────
const AVATARS = [
  '😀','😎','🤠','🧐','😏','🤩','😂','🥸',
  '👻','🤖','👾','🎭','🦊','🐯','🦁','🐻',
  '🐼','🐸','🦄','🐲','👑','🎩','🧢','🪄'
];

const AVATAR_BG_COLORS = [
  '#2196F3','#4CAF50','#FF5722','#9C27B0',
  '#F44336','#FF9800','#009688','#795548',
  '#607D8B','#E91E63','#3F51B5','#00BCD4'
];

module.exports = { PlayerProfileManager, AVATARS, AVATAR_BG_COLORS };
