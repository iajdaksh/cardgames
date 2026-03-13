const { v4: uuidv4 } = require('uuid');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return this.rooms.has(code) ? this.generateCode() : code;
  }

  createRoom(gameType, isPrivate, player) {
    const code = this.generateCode();
    const room = {
      code,
      gameType,       // 'mendicot' | 'courtpiece'
      isPrivate,
      status: 'waiting',
      players: [{ ...player, team: 0, position: 0 }],
      dealerIndex: 0,
      game: null,
      createdAt: Date.now()
    };
    this.rooms.set(code, room);

    // Auto-cleanup empty rooms after 10 min
    setTimeout(() => {
      const r = this.rooms.get(code);
      if (r && r.players.length === 0) this.rooms.delete(code);
    }, 600000);

    return room;
  }

  joinRoom(code, player) {
    const room = this.rooms.get(code);
    if (!room) return { success: false, message: 'Room not found' };
    if (room.players.length >= 4) return { success: false, message: 'Room is full' };
    if (room.status === 'playing') return { success: false, message: 'Game already in progress' };

    // Assign team and position
    // Positions: 0=South, 1=West, 2=North, 3=East
    // Teams: 0&2 = Team A, 1&3 = Team B
    const position = room.players.length;
    const team = position % 2 === 0 ? 0 : 1;

    room.players.push({ ...player, team, position });
    return { success: true, room };
  }

  leaveRoom(code, playerId) {
    const room = this.rooms.get(code);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== playerId);
    if (room.players.length === 0) {
      this.rooms.delete(code);
    }
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  getPublicRooms(gameType) {
    const rooms = [];
    for (const room of this.rooms.values()) {
      if (!room.isPrivate && room.gameType === gameType && room.status === 'waiting') {
        rooms.push(this.getRoomPublicData(room));
      }
    }
    return rooms;
  }

  getRoomPublicData(room) {
    return {
      code: room.code,
      gameType: room.gameType,
      isPrivate: room.isPrivate,
      status: room.status,
      playerCount: room.players.length,
      players: room.players.map(p => ({ id: p.id, name: p.name, team: p.team, position: p.position })),
      dealerIndex: room.dealerIndex
    };
  }

  rotateDealerToLoser(code, loserTeam) {
    const room = this.rooms.get(code);
    if (!room) return;
    // Find a player from losing team to be next dealer
    const loserPlayer = room.players.find(p => p.team === loserTeam);
    if (loserPlayer) {
      room.dealerIndex = loserPlayer.position;
    }
  }
}

module.exports = RoomManager;
