import React, { useState, useEffect } from 'react';
import PlayerHand from './PlayerHand';

export default function CardTable({ player, room, gameState, myCards, myPosition, onAction, gameType, children }) {
  const [turnTimer, setTurnTimer] = useState(null); // { playerId, total, remaining }
  const players = gameState?.players || room?.players || [];

  // ── Turn timer countdown ──
  useEffect(() => {
    if (!gameState?.currentTurn) { setTurnTimer(null); return; }
    const total = 30; // 20 + 10 extra shown as one bar
    setTurnTimer({ playerId: gameState.currentTurn, total, remaining: 20 });
    const interval = setInterval(() => {
      setTurnTimer(prev => {
        if (!prev) return null;
        if (prev.remaining <= 0) { clearInterval(interval); return null; }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState?.currentTurn]);

  const getRelPos = (absPos) => (absPos - myPosition + 4) % 4;
  const getPlayerAt = (rel) => players.find(p => getRelPos(p.position) === rel);
  const myPlayer = players.find(p => p.id === player.id);
  const isMyTurn = gameState?.currentTurn === player.id;
  const currentTrick = gameState?.currentTrick || [];
  const getTrickCard = (pid) => currentTrick.find(t => t.playerId === pid)?.card;

  return (
    <div className="card-table">
      {/* Trump badge */}
      {gameState?.trumpSuit && (
        <div className={`trump-badge red-suit-${gameState.trumpSuit === 'hearts' || gameState.trumpSuit === 'diamonds'}`}>
          Trump: {suitSym(gameState.trumpSuit)}
        </div>
      )}

      {/* Score */}
      <div className="score-panel">
        <ScoreTeam team={0} label="A" gameState={gameState} />
        <ScoreTeam team={1} label="B" gameState={gameState} />
      </div>

      {/* North */}
      <div className="pa north">
        <PlayerSlot player={getPlayerAt(2)} trickCard={getTrickCard(getPlayerAt(2)?.id)} gameState={gameState} turnTimer={turnTimer} myId={player.id} />
      </div>

      {/* West */}
      <div className="pa west">
        <PlayerSlot player={getPlayerAt(1)} trickCard={getTrickCard(getPlayerAt(1)?.id)} gameState={gameState} turnTimer={turnTimer} myId={player.id} />
      </div>

      {/* East */}
      <div className="pa east">
        <PlayerSlot player={getPlayerAt(3)} trickCard={getTrickCard(getPlayerAt(3)?.id)} gameState={gameState} turnTimer={turnTimer} myId={player.id} />
      </div>

      {/* Center */}
      <div className="pa center-area">{children}</div>

      {/* South (me) */}
      <div className="pa south">
        <div className={`my-area-header ${isMyTurn ? 'my-turn-glow' : ''}`}>
          <div className="my-avatar-wrap">
            <div className="player-avatar" style={{ background: myPlayer?.avatarBg || '#2196F3' }}>
              {myPlayer?.avatar || '😀'}
            </div>
            <span className={`online-dot ${myPlayer?.isOnline !== false ? 'online' : 'offline'}`} />
          </div>
          <div className="my-name-wrap">
            <span className="my-name">{player.name}</span>
            {myPlayer?.checkmark && <span className="checkmark">✅</span>}
            {isMyTurn && <span className="turn-label">YOUR TURN</span>}
          </div>
          {getTrickCard(player.id) && <Card card={getTrickCard(player.id)} />}
        </div>
        {turnTimer?.playerId === player.id && (
          <TimerBar remaining={turnTimer.remaining} total={turnTimer.total} />
        )}
        <PlayerHand
          cards={myCards}
          isMyTurn={isMyTurn && (gameState?.phase === 'playing' || gameState?.phase === 'playing_5')}
          currentTrick={currentTrick}
          trumpSuit={gameState?.trumpSuit}
          onPlayCard={(cardId) => onAction('play_card', { cardId })}
        />
      </div>
    </div>
  );
}

function PlayerSlot({ player, trickCard, gameState, turnTimer, myId }) {
  if (!player) return <div className="empty-seat-pill">⭕ Empty</div>;
  const isActive = gameState?.currentTurn === player.id;
  const isOffline = player.isOnline === false;
  const isBot = player.isBot;
  const timerActive = turnTimer?.playerId === player.id;

  return (
    <div className={`player-slot ${isActive ? 'active' : ''} ${isOffline ? 'offline-player' : ''}`}>
      <div className="ps-avatar-wrap">
        <div className="player-avatar sm" style={{ background: isOffline ? '#444' : (player.avatarBg || '#2196F3'), opacity: isOffline ? 0.5 : 1 }}>
          {isOffline ? '💤' : (player.avatar || '😀')}
        </div>
        <span className={`online-dot ${isOffline ? 'offline' : 'online'}`} />
        {isBot && !isOffline && <span className="bot-tag">🤖</span>}
      </div>
      <div className="ps-info">
        <span className="ps-name" style={{ opacity: isOffline ? 0.5 : 1 }}>{player.name}</span>
        {player.checkmark && <span className="checkmark-sm">✅</span>}
        <span className="ps-cards">🂠 {gameState?.handCounts?.[player.id] || 0}</span>
      </div>
      {timerActive && <TimerBar remaining={turnTimer.remaining} total={turnTimer.total} sm />}
      {trickCard && <Card card={trickCard} sm />}
    </div>
  );
}

function ScoreTeam({ team, label, gameState }) {
  return (
    <div className={`score-team t${team}`}>
      <span>Team {label}</span>
      <span>{gameState?.scores?.[team] ?? 0}pt</span>
      {gameState?.capturedTricks && <span>{gameState.capturedTricks[team]}🃏</span>}
      {gameState?.tensCapture && <span>{gameState.tensCapture[team]}×10</span>}
    </div>
  );
}

function TimerBar({ remaining, total, sm }) {
  const pct = Math.max(0, (remaining / total) * 100);
  const color = remaining <= 5 ? '#e74c3c' : remaining <= 10 ? '#FF9800' : '#4CAF50';
  return (
    <div className={`timer-bar-wrap ${sm ? 'sm' : ''}`}>
      <div className="timer-bar-track">
        <div className="timer-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {!sm && <span className="timer-bar-label" style={{ color }}>{remaining}s</span>}
    </div>
  );
}

export function Card({ card, onClick, selected, playable, sm }) {
  if (!card) return null;
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  return (
    <div className={`card ${isRed ? 'red' : 'black'} ${selected ? 'selected' : ''} ${playable ? 'playable' : ''} ${onClick ? 'clickable' : ''} ${sm ? 'sm' : ''}`} onClick={onClick}>
      <div className="cr top">{card.rank}</div>
      <div className="cs">{suitSym(card.suit)}</div>
      <div className="cr bot">{card.rank}</div>
    </div>
  );
}

export function suitSym(suit) {
  return { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[suit] || suit;
}
