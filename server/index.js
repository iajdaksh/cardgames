const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const RoomManager = require('./rooms/roomManager');
const MendicotGame = require('./games/mendicot');
const CourtPieceGame = require('./games/courtpiece');
const { botPickCard, botCallTrump, botDecideRaise, createBot } = require('./games/botAI');
const TurnTimerManager = require('./utils/turnTimer');
const { PlayerProfileManager, AVATARS, AVATAR_BG_COLORS } = require('./utils/playerProfile');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'], credentials: true } });

app.use(cors({ origin: '*', credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.static('../client/build'));

const roomManager = new RoomManager();
const timerManager = new TurnTimerManager(io);
const profileManager = new PlayerProfileManager();

// ─── Quick Chat Messages ─────────────────────────────────────────────────────
const QUICK_CHATS = [
  { id: 'gl',    text: '👋 Good luck!'       },
  { id: 'wp',    text: '👏 Well played!'      },
  { id: 'ty',    text: '🙏 Thank you!'        },
  { id: 'gg',    text: '🎉 Good game!'        },
  { id: 'np',    text: '😅 No problem!'       },
  { id: 'hurry', text: '⏰ Hurry up!'         },
  { id: 'nice',  text: '😎 Nice move!'        },
  { id: 'oops',  text: '😬 Oops!'            },
  { id: 'think', text: '🤔 Let me think...'   },
  { id: 'back',  text: "🔙 I'm back!"         },
  { id: 'brb',   text: '⏳ BRB'              },
  { id: 'lol',   text: '😂 LOL!'             }
];

app.get('/api/quick-chats', (_, res) => res.json(QUICK_CHATS));
app.get('/api/avatars', (_, res) => res.json({ avatars: AVATARS, bgColors: AVATAR_BG_COLORS }));

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── Set Player Identity ──────────────────────────────────────────────────
  socket.on('set_player', ({ playerName, playerId, avatar, avatarBg }) => {
    const id = playerId || uuidv4();
    socket.playerId = id;
    const profile = profileManager.getOrCreate(id, playerName);
    if (avatar) profileManager.setAvatar(id, avatar, avatarBg);
    socket.playerName = profile.name;
    socket.emit('player_set', {
      playerId: id,
      playerName: profile.name,
      profile: profileManager.getMyProfile(id),
      quickChats: QUICK_CHATS,
      avatars: AVATARS,
      bgColors: AVATAR_BG_COLORS
    });
  });

  // ── Update Profile ───────────────────────────────────────────────────────
  socket.on('update_profile', ({ name, avatar, avatarBg }) => {
    if (!socket.playerId) return;
    if (name) profileManager.setName(socket.playerId, name);
    if (avatar) profileManager.setAvatar(socket.playerId, avatar, avatarBg);
    socket.playerName = profileManager.get(socket.playerId)?.name;
    socket.emit('profile_updated', { profile: profileManager.getMyProfile(socket.playerId) });
    if (socket.currentRoom) {
      const room = roomManager.getRoom(socket.currentRoom);
      if (room) {
        const p = room.players.find(p => p.id === socket.playerId);
        if (p) { p.name = socket.playerName; p.avatar = avatar; p.avatarBg = avatarBg; }
        io.to(socket.currentRoom).emit('room_update', { room: roomManager.getRoomPublicData(room) });
      }
    }
  });

  // ── Lobby ────────────────────────────────────────────────────────────────
  socket.on('get_lobby', ({ gameType }) => {
    socket.emit('lobby_update', { rooms: roomManager.getPublicRooms(gameType) });
  });

  // ── Create Room ──────────────────────────────────────────────────────────
  socket.on('create_room', ({ gameType, isPrivate, playerName, playerId, withBots }) => {
    socket.playerId = playerId || socket.playerId || uuidv4();
    socket.playerName = playerName || socket.playerName || `Player_${socket.id.slice(0, 5)}`;
    profileManager.getOrCreate(socket.playerId, socket.playerName);
    const profile = profileManager.get(socket.playerId);

    const room = roomManager.createRoom(gameType, isPrivate, {
      id: socket.playerId, name: socket.playerName,
      avatar: profile?.avatar || '😀', avatarBg: profile?.avatarBg || '#2196F3',
      socketId: socket.id, isBot: false, isOnline: true,
      checkmark: profile?.checkmark || false
    });

    socket.join(room.code);
    socket.currentRoom = room.code;
    socket.emit('room_created', { room: roomManager.getRoomPublicData(room) });

    if (withBots) fillRoomWithBots(room, io, roomManager);
  });

  // ── Join Room ────────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomCode, playerName, playerId }) => {
    socket.playerId = playerId || socket.playerId || uuidv4();
    socket.playerName = playerName || socket.playerName || `Player_${socket.id.slice(0, 5)}`;
    profileManager.getOrCreate(socket.playerId, socket.playerName);
    const profile = profileManager.get(socket.playerId);
    const code = roomCode.toUpperCase();

    const room = roomManager.getRoom(code);
    if (room?.players?.[0] && profileManager.isBlocked(room.players[0].id, socket.playerId)) {
      socket.emit('error', { message: 'You are blocked from this room.' });
      return;
    }

    const result = roomManager.joinRoom(code, {
      id: socket.playerId, name: socket.playerName,
      avatar: profile?.avatar || '😀', avatarBg: profile?.avatarBg || '#2196F3',
      socketId: socket.id, isBot: false, isOnline: true,
      checkmark: profile?.checkmark || false
    });

    if (!result.success) { socket.emit('error', { message: result.message }); return; }

    socket.join(code);
    socket.currentRoom = code;
    io.to(code).emit('room_update', { room: roomManager.getRoomPublicData(result.room) });
    io.emit('lobby_refresh', { gameType: result.room.gameType });
    if (result.room.players.length === 4) startGame(result.room, io, roomManager);
  });

  // ── Leave Room ───────────────────────────────────────────────────────────
  socket.on('leave_room', () => handleLeave(socket, io, roomManager));

  // ── Game Action ──────────────────────────────────────────────────────────
  socket.on('game_action', ({ roomCode, action, data }) => {
    const room = roomManager.getRoom(roomCode);
    if (!room?.game) return;

    timerManager.playerActed(roomCode, socket.playerId);
    const result = room.game.handleAction(socket.playerId, action, data);
    if (!result) return;

    broadcastGameState(room, io);
    if (result.gameOver) {
      handleGameOver(room, result, io, roomManager);
    } else if (result.cardsDealt) {
      sendPrivateCards(room, io);
      startTurnTimer(room, io, roomManager);
    } else {
      startTurnTimer(room, io, roomManager);
    }
  });

  // ── Quick Chat ───────────────────────────────────────────────────────────
  socket.on('quick_chat', ({ roomCode, chatId }) => {
    const msg = QUICK_CHATS.find(c => c.id === chatId);
    if (!msg || !roomCode) return;
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    room.players.forEach(p => {
      if (p.isBot || profileManager.isMuted(p.id, socket.playerId)) return;
      const pSocket = getSocketByPlayerId(io, p.id);
      if (pSocket) pSocket.emit('chat_message', {
        playerId: socket.playerId, playerName: socket.playerName,
        message: msg.text, time: Date.now()
      });
    });
  });

  // ── Social ───────────────────────────────────────────────────────────────
  socket.on('block_player',    ({ targetId }) => { profileManager.blockPlayer(socket.playerId, targetId);    socket.emit('profile_updated', { profile: profileManager.getMyProfile(socket.playerId) }); });
  socket.on('unblock_player',  ({ targetId }) => { profileManager.unblockPlayer(socket.playerId, targetId);  socket.emit('profile_updated', { profile: profileManager.getMyProfile(socket.playerId) }); });
  socket.on('mute_player',     ({ targetId }) => { profileManager.mutePlayer(socket.playerId, targetId);     socket.emit('profile_updated', { profile: profileManager.getMyProfile(socket.playerId) }); });
  socket.on('unmute_player',   ({ targetId }) => { profileManager.unmutePlayer(socket.playerId, targetId);   socket.emit('profile_updated', { profile: profileManager.getMyProfile(socket.playerId) }); });
  socket.on('favorite_player', ({ targetId }) => { profileManager.favoritePlayer(socket.playerId, targetId); socket.emit('profile_updated', { profile: profileManager.getMyProfile(socket.playerId) }); });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    if (socket.playerId) profileManager.setOnline(socket.playerId, false);
    handleDisconnect(socket, io, roomManager);
  });
});

// ─── Fill Room With Bots ─────────────────────────────────────────────────────
function fillRoomWithBots(room, io, roomManager) {
  while (room.players.length < 4) {
    const pos = room.players.length;
    const bot = createBot(pos);
    bot.avatar = '🤖'; bot.avatarBg = '#607D8B'; bot.checkmark = true;
    room.players.push(bot);
  }
  io.to(room.code).emit('room_update', { room: roomManager.getRoomPublicData(room) });
  setTimeout(() => startGame(room, io, roomManager), 800);
}

// ─── Start Game ──────────────────────────────────────────────────────────────
function startGame(room, io, roomManager) {
  const GameClass = room.gameType === 'mendicot' ? MendicotGame : room.gameType === 'courtpiece' ? CourtPieceGame : null;
  if (!GameClass) return;

  const game = new GameClass(room.players);
  room.game = game;
  room.status = 'playing';
  game.start();

  sendPrivateCards(room, io);
  broadcastGameState(room, io);
  io.to(room.code).emit('game_started', { gameType: room.gameType });
  console.log(`[Game] Started: ${room.gameType} in ${room.code}`);
  startTurnTimer(room, io, roomManager);
}

// ─── Send Private Cards ──────────────────────────────────────────────────────
function sendPrivateCards(room, io) {
  room.players.forEach(player => {
    if (player.isBot) return;
    const s = getSocketByPlayerId(io, player.id);
    if (s) s.emit('my_cards', { cards: room.game.getPlayerCards(player.id), myPosition: player.position });
  });
}

// ─── Turn Timer ──────────────────────────────────────────────────────────────
function startTurnTimer(room, io, roomManager) {
  if (!room.game) return;
  const state = room.game.getPublicState();
  const currentPlayerId = state.currentTurn;
  if (!currentPlayerId) return;

  const currentPlayer = room.players.find(p => p.id === currentPlayerId);
  if (!currentPlayer) return;

  if (currentPlayer.isBot) {
    setTimeout(() => executeBotTurn(room, io, roomManager), 1000 + Math.random() * 800);
    return;
  }

  io.to(room.code).emit('turn_start', { playerId: currentPlayerId, timeLimit: 20, phase: state.phase });

  timerManager.start(room.code, currentPlayerId,
    (playerId) => {
      io.to(room.code).emit('player_auto_played', { playerId, playerName: currentPlayer.name });
      executeForcedMove(room, playerId, io, roomManager);
    },
    (playerId) => markPlayerOffline(room, playerId, io, roomManager)
  );
}

// ─── Bot Turn ────────────────────────────────────────────────────────────────
function executeBotTurn(room, io, roomManager) {
  if (!room.game) return;
  const state = room.game.getPublicState();
  const botId = state.currentTurn;
  const bot = room.players.find(p => p.id === botId);
  if (!bot?.isBot) return;

  const hand = room.game.getPlayerCards(botId);
  let result = null;

  if (state.phase === 'trump_call') {
    const suit = botCallTrump(hand);
    result = room.game.handleAction(botId, 'call_trump', { suit });
    io.to(room.code).emit('chat_message', { playerId: botId, playerName: bot.name, message: `🃏 I call ${suit}!`, time: Date.now() });
  } else if (state.phase === 'raise') {
    const expectedTeam = state.lastRaiseTeam === state.trumpCallerTeam ? state.dealerTeam : state.trumpCallerTeam;
    if (bot.team === expectedTeam) {
      const shouldRaise = botDecideRaise(hand, state.trumpSuit, state.targetTricks);
      result = room.game.handleAction(botId, shouldRaise ? 'raise' : 'pass_raise', {});
    }
  } else if (state.phase === 'playing' || state.phase === 'playing_5') {
    const card = botPickCard(hand, state.currentTrick, state.trumpSuit, room.gameType, { myTeam: bot.team });
    if (card) result = room.game.handleAction(botId, 'play_card', { cardId: card.id });
  }

  if (result) {
    broadcastGameState(room, io);
    if (result.gameOver) handleGameOver(room, result, io, roomManager);
    else if (result.cardsDealt) { sendPrivateCards(room, io); startTurnTimer(room, io, roomManager); }
    else startTurnTimer(room, io, roomManager);
  }
}

// ─── Forced Move (idle human) ────────────────────────────────────────────────
function executeForcedMove(room, playerId, io, roomManager) {
  if (!room.game) return;
  const state = room.game.getPublicState();
  const hand = room.game.getPlayerCards(playerId);
  const player = room.players.find(p => p.id === playerId);
  let result = null;

  if (state.phase === 'trump_call') {
    result = room.game.handleAction(playerId, 'call_trump', { suit: botCallTrump(hand) });
  } else if (state.phase === 'raise') {
    result = room.game.handleAction(playerId, 'pass_raise', {});
  } else if (state.phase === 'playing' || state.phase === 'playing_5') {
    const card = botPickCard(hand, state.currentTrick, state.trumpSuit, room.gameType, { myTeam: player?.team });
    if (card) result = room.game.handleAction(playerId, 'play_card', { cardId: card.id });
  }

  if (result) {
    broadcastGameState(room, io);
    if (result.gameOver) handleGameOver(room, result, io, roomManager);
    else if (result.cardsDealt) { sendPrivateCards(room, io); startTurnTimer(room, io, roomManager); }
    else startTurnTimer(room, io, roomManager);
  }
}

// ─── Mark Player Offline ─────────────────────────────────────────────────────
function markPlayerOffline(room, playerId, io, roomManager) {
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.isBot) return;
  player.isOnline = false;
  player.isBot = true;
  player.originalName = player.name;
  player.name = player.name + ' 🤖';
  profileManager.setOnline(playerId, false);
  profileManager.recordGameAbandoned(playerId);
  io.to(room.code).emit('player_offline', { playerId, playerName: player.originalName, message: `${player.originalName} went offline — bot took over 🤖` });
  broadcastGameState(room, io);
}

// ─── Disconnect Handler ──────────────────────────────────────────────────────
function handleDisconnect(socket, io, roomManager) {
  if (!socket.currentRoom) return;
  const room = roomManager.getRoom(socket.currentRoom);
  if (!room) return;
  if (room.status === 'playing') {
    markPlayerOffline(room, socket.playerId, io, roomManager);
  } else {
    roomManager.leaveRoom(socket.currentRoom, socket.playerId);
    io.to(socket.currentRoom).emit('room_update', { room: roomManager.getRoomPublicData(room) });
  }
  socket.leave(socket.currentRoom);
  socket.currentRoom = null;
}

function handleLeave(socket, io, roomManager) {
  if (!socket.currentRoom) return;
  const room = roomManager.getRoom(socket.currentRoom);
  if (!room) return;
  if (room.status === 'playing') {
    markPlayerOffline(room, socket.playerId, io, roomManager);
    profileManager.recordGameAbandoned(socket.playerId);
  } else {
    roomManager.leaveRoom(socket.currentRoom, socket.playerId);
    io.to(socket.currentRoom).emit('room_update', { room: roomManager.getRoomPublicData(room) });
  }
  socket.leave(socket.currentRoom);
  socket.currentRoom = null;
}

// ─── Broadcast Game State ────────────────────────────────────────────────────
function broadcastGameState(room, io) {
  if (!room.game) return;
  const state = room.game.getPublicState();
  state.players = state.players.map(p => {
    const rp = room.players.find(r => r.id === p.id) || {};
    return { ...p, isOnline: rp.isOnline !== false, isBot: rp.isBot || false, avatar: rp.avatar || '😀', avatarBg: rp.avatarBg || '#2196F3', checkmark: rp.checkmark || false };
  });
  io.to(room.code).emit('game_state', state);
}

// ─── Game Over ───────────────────────────────────────────────────────────────
function handleGameOver(room, result, io, roomManager) {
  timerManager.clear(room.code);
  room.status = 'waiting';
  room.game = null;
  room.players.forEach(p => {
    if (!p.isBot) {
      profileManager.recordGameCompleted(p.id);
      const isWinner = (result.winner?.includes('A') && p.team === 0) || (result.winner?.includes('B') && p.team === 1);
      if (isWinner) profileManager.recordWin(p.id);
    }
  });
  io.to(room.code).emit('game_over', { winner: result.winner, reason: result.reason, scores: result.scores, isKot: result.isKot || false, tensCapture: result.tensCapture });
  roomManager.rotateDealerToLoser(room.code, result.loserTeam);
  console.log(`[Game] Over in ${room.code} | Winner: ${result.winner}`);
}

function getSocketByPlayerId(io, playerId) {
  for (const [, socket] of io.sockets.sockets) {
    if (socket.playerId === playerId) return socket;
  }
  return null;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`\n🃏 Card Games Server → http://localhost:${PORT}\n`));
