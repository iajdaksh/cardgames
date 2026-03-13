import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../socket';
import CardTable from './CardTable';
import WaitingRoom from './WaitingRoom';
import MendicotUI from './MendicotUI';
import CourtPieceUI from './CourtPieceUI';

export default function GameRoom({ player, profile, room, gameType, gameState, myCards, myPosition, quickChats, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [showSocial, setShowSocial] = useState(null); // playerId
  const [socialTarget, setSocialTarget] = useState(null);
  const messagesEndRef = useRef(null);
  const socket = getSocket();

  useEffect(() => {
    socket.on('chat_message', (msg) => {
      setMessages(prev => [...prev.slice(-60), msg]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    return () => socket.off('chat_message');
  }, []);

  const sendQuickChat = (chatId) => {
    socket.emit('quick_chat', { roomCode: room.code, chatId });
  };

  const handleAction = (action, data) => {
    socket.emit('game_action', { roomCode: room.code, action, data });
  };

  const handleSocial = (action, targetId) => {
    socket.emit(action, { targetId });
    setShowSocial(null);
  };

  const openSocialMenu = (targetPlayer) => {
    if (targetPlayer.id === player.id) return;
    setSocialTarget(targetPlayer);
    setShowSocial(targetPlayer.id);
  };

  const isBlocked = (targetId) => profile?.blockedPlayers?.includes(targetId);
  const isMuted = (targetId) => profile?.mutedPlayers?.includes(targetId);
  const isFav = (targetId) => profile?.favoritePlayers?.includes(targetId);

  if (room.status === 'waiting' || !gameState) {
    return <WaitingRoom player={player} room={room} onLeave={onLeave} />;
  }

  const otherPlayers = (gameState?.players || []).filter(p => p.id !== player.id);

  return (
    <div className="game-room">
      {/* Social menu popup */}
      {showSocial && socialTarget && (
        <div className="social-menu" onClick={() => setShowSocial(null)}>
          <div className="social-card" onClick={e => e.stopPropagation()}>
            <div className="social-header">
              <div className="soc-avatar" style={{ background: socialTarget.avatarBg || '#2196F3' }}>
                {socialTarget.avatar || '😀'}
              </div>
              <span>{socialTarget.name}</span>
              <button className="btn-close" onClick={() => setShowSocial(null)}>✕</button>
            </div>
            <div className="social-actions">
              <button onClick={() => handleSocial(isMuted(socialTarget.id) ? 'unmute_player' : 'mute_player', socialTarget.id)}>
                {isMuted(socialTarget.id) ? '🔊 Unmute' : '🔇 Mute'}
              </button>
              <button onClick={() => handleSocial(isBlocked(socialTarget.id) ? 'unblock_player' : 'block_player', socialTarget.id)}>
                {isBlocked(socialTarget.id) ? '✅ Unblock' : '⛔ Block'}
              </button>
              <button onClick={() => handleSocial(isFav(socialTarget.id) ? 'unfavorite_player' : 'favorite_player', socialTarget.id)}>
                {isFav(socialTarget.id) ? '💛 Unfavorite' : '⭐ Favorite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="table-area">
        <CardTable
          player={player}
          room={room}
          gameState={gameState}
          myCards={myCards}
          myPosition={myPosition}
          onAction={handleAction}
          gameType={gameType}
          onPlayerClick={openSocialMenu}
        >
          {gameType === 'mendicot'
            ? <MendicotUI gameState={gameState} myCards={myCards} player={player} onAction={handleAction} />
            : <CourtPieceUI gameState={gameState} myCards={myCards} player={player} onAction={handleAction} />
          }
        </CardTable>
      </div>

      {/* Side Panel */}
      <div className="side-panel">
        {/* Quick Chat */}
        <div className="quick-chat-panel">
          <div className="qc-title">💬 Quick Chat</div>
          <div className="qc-grid">
            {quickChats.map(qc => (
              <button key={qc.id} className="qc-btn" onClick={() => sendQuickChat(qc.id)}>
                {qc.text}
              </button>
            ))}
          </div>
        </div>

        {/* Chat messages */}
        <div className="chat-log">
          {messages.map((m, i) => (
            <div key={i} className="chat-entry">
              <span className="chat-who">{m.playerName}:</span>
              <span className="chat-what">{m.message}</span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Players list */}
        <div className="players-sidebar">
          {(gameState?.players || []).map(p => (
            <div
              key={p.id}
              className={`sidebar-player ${p.id === player.id ? 'me' : 'clickable'}`}
              onClick={() => p.id !== player.id && openSocialMenu(p)}
            >
              <div className="sp-avatar" style={{ background: p.isOnline === false ? '#444' : (p.avatarBg || '#2196F3'), opacity: p.isOnline === false ? 0.5 : 1 }}>
                {p.isOnline === false ? '💤' : (p.avatar || '😀')}
              </div>
              <span className={`online-dot ${p.isOnline !== false ? 'online' : 'offline'}`} />
              <span className="sp-name" style={{ opacity: p.isOnline === false ? 0.5 : 1 }}>
                {p.name}
                {p.id === player.id && ' (You)'}
                {p.checkmark && ' ✅'}
                {p.isBot && ' 🤖'}
              </span>
              <span className={`sp-team t${p.team}`}>T{p.team === 0 ? 'A' : 'B'}</span>
            </div>
          ))}
        </div>

        <button className="btn-leave-full" onClick={onLeave}>🚪 Leave Game</button>
      </div>
    </div>
  );
}
