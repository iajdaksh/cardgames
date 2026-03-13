import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getSocket } from './socket';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';
import ProfileSetup from './components/ProfileSetup';
import './App.css';

function App() {
  const [player, setPlayer] = useState(null);
  const [profile, setProfile] = useState(null);
  const [room, setRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [myCards, setMyCards] = useState([]);
  const [myPosition, setMyPosition] = useState(0);
  const [gameType, setGameType] = useState(null);
  const [notification, setNotification] = useState(null);
  const [quickChats, setQuickChats] = useState([]);
  const [avatarOptions, setAvatarOptions] = useState({ avatars: [], bgColors: [] });
  const [setupDone, setSetupDone] = useState(false);

  // ── Init from cookie ──────────────────────────────────────────────────────
  useEffect(() => {
    let playerId = getCookie('playerId');
    let playerName = getCookie('playerName');
    let playerAvatar = getCookie('playerAvatar') || '😀';
    let playerBg = getCookie('playerAvatarBg') || '#2196F3';
    if (!playerId) { playerId = uuidv4(); setCookie('playerId', playerId, 365); }
    setPlayer({ id: playerId, name: playerName, avatar: playerAvatar, avatarBg: playerBg });
    if (playerName) setSetupDone(true);
  }, []);

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!player?.id) return;
    const socket = getSocket();

    socket.emit('set_player', {
      playerId: player.id,
      playerName: player.name,
      avatar: player.avatar,
      avatarBg: player.avatarBg
    });

    socket.on('player_set', ({ playerId, playerName, profile, quickChats, avatars, bgColors }) => {
      setPlayer(p => ({ ...p, id: playerId, name: playerName }));
      setProfile(profile);
      if (quickChats) setQuickChats(quickChats);
      if (avatars) setAvatarOptions({ avatars, bgColors });
    });

    socket.on('profile_updated', ({ profile }) => setProfile(profile));

    socket.on('room_created', ({ room }) => setRoom(room));
    socket.on('room_update', ({ room }) => setRoom(room));

    socket.on('game_started', ({ gameType }) => setGameType(gameType));

    socket.on('my_cards', ({ cards, myPosition: pos }) => {
      setMyCards(cards);
      setMyPosition(pos);
    });

    socket.on('game_state', (state) => setGameState(state));

    socket.on('turn_start', ({ playerId, timeLimit }) => {
      // Handled inside GameRoom
    });

    socket.on('turn_warning', ({ playerId, extraSeconds }) => {
      if (playerId === player.id) {
        showToast(`⏰ ${extraSeconds}s extra time!`, 'warning');
      }
    });

    socket.on('player_auto_played', ({ playerName }) => {
      showToast(`⚡ Auto-played for ${playerName}`, 'info');
    });

    socket.on('player_offline', ({ playerName, message }) => {
      showToast(`💤 ${message}`, 'warning');
    });

    socket.on('game_over', (result) => {
      setNotification({ type: 'game_over', ...result });
      setTimeout(() => {
        setGameState(null);
        setMyCards([]);
        setRoom(p => p ? { ...p, status: 'waiting' } : null);
        setNotification(null);
      }, 5000);
    });

    socket.on('game_interrupted', ({ message }) => {
      showToast(message, 'error');
    });

    socket.on('player_left', ({ room }) => setRoom(room));
    socket.on('error', ({ message }) => showToast(message, 'error'));

    return () => {
      ['player_set','profile_updated','room_created','room_update','game_started',
       'my_cards','game_state','turn_start','turn_warning','player_auto_played',
       'player_offline','game_over','game_interrupted','player_left','error'
      ].forEach(e => socket.off(e));
    };
  }, [player?.id]);

  const showToast = (message, type = 'info') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleProfileSave = ({ name, avatar, avatarBg }) => {
    setCookie('playerName', name, 365);
    setCookie('playerAvatar', avatar, 365);
    setCookie('playerAvatarBg', avatarBg, 365);
    setPlayer(p => ({ ...p, name, avatar, avatarBg }));
    setSetupDone(true);
    const socket = getSocket();
    socket.emit('update_profile', { name, avatar, avatarBg });
  };

  const handleLeaveRoom = () => {
    getSocket().emit('leave_room');
    setRoom(null);
    setGameState(null);
    setMyCards([]);
    setGameType(null);
  };

  // ── Profile Setup (first time or change) ─────────────────────────────────
  if (!setupDone || !player?.name) {
    return (
      <div className="app">
        <ProfileSetup
          player={player}
          avatarOptions={avatarOptions}
          onSave={handleProfileSave}
          isFirstTime={!player?.name}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {notification && <Toast data={notification} />}
      {!room ? (
        <Lobby
          player={player}
          profile={profile}
          avatarOptions={avatarOptions}
          quickChats={quickChats}
          onProfileEdit={() => setSetupDone(false)}
        />
      ) : (
        <GameRoom
          player={player}
          profile={profile}
          room={room}
          gameType={gameType}
          gameState={gameState}
          myCards={myCards}
          myPosition={myPosition}
          quickChats={quickChats}
          onLeave={handleLeaveRoom}
        />
      )}
    </div>
  );
}

function Toast({ data }) {
  if (data.type === 'game_over') {
    return (
      <div className="toast game-over-toast">
        <div className="toast-icon">{data.winner === 'Draw' ? '🤝' : '🏆'}</div>
        <div>
          <div className="toast-title">{data.winner === 'Draw' ? 'Draw!' : `${data.winner} Wins!`}</div>
          <div className="toast-sub">{data.reason}</div>
          {data.isKot && <div className="toast-kot">🎯 KOT!</div>}
        </div>
      </div>
    );
  }
  const icons = { warning: '⚠️', error: '❌', info: 'ℹ️' };
  return (
    <div className={`toast toast-${data.type}`}>
      <span>{icons[data.type] || 'ℹ️'}</span>
      <span>{data.message}</span>
    </div>
  );
}

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[2]) : null;
}
function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 86400000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/`;
}

export default App;
