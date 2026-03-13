import React, { useState, useEffect } from 'react';
import { getSocket } from '../socket';

export default function Lobby({ player, profile, avatarOptions, quickChats, onProfileEdit }) {
  const [view, setView] = useState('home');
  const [selectedGame, setSelectedGame] = useState(null);
  const [publicRooms, setPublicRooms] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const socket = getSocket();

  useEffect(() => {
    socket.on('lobby_update', ({ rooms }) => setPublicRooms(rooms));
    socket.on('room_created', () => {});
    return () => { socket.off('lobby_update'); };
  }, []);

  const fetchRooms = (gameType) => socket.emit('get_lobby', { gameType });

  const createRoom = (gameType, isPrivate, withBots = false) => {
    socket.emit('create_room', {
      gameType, isPrivate, withBots,
      playerName: player.name,
      playerId: player.id
    });
  };

  const joinRoom = (code) => {
    if (!code.trim()) return;
    socket.emit('join_room', { roomCode: code.trim().toUpperCase(), playerName: player.name, playerId: player.id });
  };

  // ── Home ────────────────────────────────────────────────────────────────
  if (view === 'home') return (
    <div className="lobby">
      <div className="lobby-header">
        <h1>🃏 Card Games</h1>
        <div className="player-profile-badge" onClick={onProfileEdit}>
          <div className="badge-avatar" style={{ background: player.avatarBg || '#2196F3' }}>
            {player.avatar || '😀'}
          </div>
          <div className="badge-info">
            <span className="badge-name">{player.name}</span>
            {profile?.checkmark && <span className="badge-check">✅</span>}
            <span className="badge-stats">{profile?.wins || 0}W · {profile?.gamesPlayed || 0}GP</span>
          </div>
          <span className="badge-edit">✏️</span>
        </div>
      </div>

      <div className="game-section">
        <h2>Choose a Game</h2>
        <div className="game-cards">
          <GameCard
            icon="🎴" title="Mendicot" subtitle="Dehla Pakad"
            desc="Capture the four 10s to win"
            tags={['2 Consecutive tricks', 'Natural trump', 'Capture 10s']}
            onClick={() => { setSelectedGame('mendicot'); setView('mode'); }}
          />
          <GameCard
            icon="♠️" title="Court Piece" subtitle="Rang • Coat Piece"
            desc="Call trump, raise the stakes, win tricks"
            tags={['Trump call on 5 cards', 'Raise system', '7–13 tricks']}
            onClick={() => { setSelectedGame('courtpiece'); setView('mode'); }}
          />
        </div>
      </div>

      <div className="join-section">
        <h3>Join with Room Code</h3>
        <div className="join-row">
          <input
            type="text" placeholder="Enter 6-digit code..."
            value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6} onKeyDown={e => e.key === 'Enter' && joinRoom(joinCode)}
          />
          <button className="btn-primary" onClick={() => joinRoom(joinCode)}>Join →</button>
        </div>
      </div>
    </div>
  );

  // ── Mode Select ─────────────────────────────────────────────────────────
  if (view === 'mode') return (
    <div className="lobby">
      <LobbyHeader onBack={() => setView('home')} title={selectedGame === 'mendicot' ? '🎴 Mendicot' : '♠️ Court Piece'} player={player} />
      <div className="mode-grid">
        <ModeCard icon="🤖" title="vs Bots" desc="Play instantly against 3 bots. Great for learning!" onClick={() => createRoom(selectedGame, true, true)} />
        <ModeCard icon="🌐" title="Public Game" desc="Join an open table with random players" onClick={() => createRoom(selectedGame, false, false)} />
        <ModeCard icon="🔒" title="Private Room" desc="Create a room and invite friends with a code" onClick={() => createRoom(selectedGame, true, false)} />
        <ModeCard icon="📋" title="Browse Tables" desc="See all open public rooms" onClick={() => { fetchRooms(selectedGame); setView('rooms'); }} />
      </div>
    </div>
  );

  // ── Room Browser ────────────────────────────────────────────────────────
  if (view === 'rooms') return (
    <div className="lobby">
      <LobbyHeader onBack={() => setView('mode')} title="Public Tables" player={player}>
        <button className="btn-icon" onClick={() => fetchRooms(selectedGame)}>🔄</button>
      </LobbyHeader>
      <div className="rooms-list">
        {publicRooms.length === 0 ? (
          <div className="empty-state">
            <p>No open tables right now</p>
            <button className="btn-primary" onClick={() => createRoom(selectedGame, false)}>Create Table</button>
          </div>
        ) : publicRooms.map(room => (
          <div key={room.code} className="room-row">
            <div className="room-row-info">
              <span className="room-code-tag">{room.code}</span>
              <span className="room-players-preview">
                {room.players.map(p => p.name).join(', ')}
              </span>
            </div>
            <div className="room-seats-row">
              {[0,1,2,3].map(i => (
                <span key={i} className={`seat-dot ${i < room.playerCount ? 'filled' : ''}`} />
              ))}
            </div>
            <button
              className="btn-join"
              disabled={room.playerCount >= 4}
              onClick={() => joinRoom(room.code)}
            >
              {room.playerCount >= 4 ? 'Full' : 'Join'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GameCard({ icon, title, subtitle, desc, tags, onClick }) {
  return (
    <div className="game-card" onClick={onClick}>
      <div className="gc-icon">{icon}</div>
      <div className="gc-title">{title}</div>
      <div className="gc-sub">{subtitle}</div>
      <div className="gc-desc">{desc}</div>
      <div className="gc-tags">{tags.map(t => <span key={t} className="gc-tag">{t}</span>)}</div>
    </div>
  );
}

function ModeCard({ icon, title, desc, onClick }) {
  return (
    <div className="mode-card" onClick={onClick}>
      <div className="mc-icon">{icon}</div>
      <div className="mc-title">{title}</div>
      <div className="mc-desc">{desc}</div>
    </div>
  );
}

function LobbyHeader({ onBack, title, player, children }) {
  return (
    <div className="lobby-header">
      <button className="btn-back" onClick={onBack}>← Back</button>
      <h2>{title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {children}
        <div className="avatar-mini" style={{ background: player.avatarBg || '#2196F3' }}>{player.avatar || '😀'}</div>
      </div>
    </div>
  );
}
