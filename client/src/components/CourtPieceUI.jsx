import React, { useState } from 'react';
import { suitSymbol } from './CardTable';

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_COLORS = { spades: '#1a1a2e', hearts: '#c0392b', diamonds: '#c0392b', clubs: '#1a1a2e' };

export default function CourtPieceUI({ gameState, myCards, player, myPosition, onAction }) {
  const [selectedSuit, setSelectedSuit] = useState(null);

  if (!gameState) return null;

  const {
    phase, trumpSuit, targetTricks, raiseCount,
    lastRaiseTeam, trumpCallerTeam, dealerTeam,
    capturedTricks, currentTurn, players
  } = gameState;

  const myPlayer = players?.find(p => p.id === player.id);
  const myTeam = myPlayer?.team;
  const isMyTurn = currentTurn === player.id;

  // ── Trump Call Phase ──
  if (phase === 'trump_call') {
    const trumpCallerPlayer = players?.[gameState.trumpCallerIndex];
    const iAmTrumpCaller = trumpCallerPlayer?.id === player.id;

    return (
      <div className="game-ui courtpiece-ui">
        <div className="phase-header">
          <h3>🃏 Call Trump</h3>
          <p>{iAmTrumpCaller ? 'You must call trump!' : `Waiting for ${trumpCallerPlayer?.name} to call trump...`}</p>
        </div>

        {iAmTrumpCaller && (
          <div className="trump-selector">
            <p className="hint">Look at your 5 cards and choose trump suit</p>
            <div className="suit-options">
              {SUITS.map(suit => (
                <button
                  key={suit}
                  className={`suit-btn suit-${suit} ${selectedSuit === suit ? 'selected' : ''}`}
                  style={{ color: SUIT_COLORS[suit] }}
                  onClick={() => setSelectedSuit(suit)}
                >
                  {suitSymbol(suit)}
                  <span>{suit}</span>
                </button>
              ))}
            </div>
            <button
              className="confirm-btn"
              disabled={!selectedSuit}
              onClick={() => {
                if (selectedSuit) {
                  onAction('call_trump', { suit: selectedSuit });
                  setSelectedSuit(null);
                }
              }}
            >
              Confirm: {selectedSuit ? `${suitSymbol(selectedSuit)} ${selectedSuit}` : 'Select suit first'}
            </button>
          </div>
        )}

        <div className="my-cards-preview">
          <p>Your 5 cards:</p>
          <div className="mini-cards">
            {myCards.map(card => (
              <span
                key={card.id}
                className={`mini-card ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'}`}
              >
                {card.rank}{suitSymbol(card.suit)}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Raise Phase ──
  if (phase === 'raise') {
    // Determine who can raise now
    const expectedTeam = lastRaiseTeam === trumpCallerTeam ? dealerTeam : trumpCallerTeam;
    const canIRaise = myTeam === expectedTeam && targetTricks < 13;

    const teamName = (t) => t === 0 ? 'Team A' : 'Team B';

    return (
      <div className="game-ui courtpiece-ui">
        <div className="phase-header">
          <h3>⬆️ Raise Round</h3>
          <p>Trump: <strong style={{ color: SUIT_COLORS[trumpSuit] }}>{suitSymbol(trumpSuit)} {trumpSuit}</strong></p>
        </div>

        <div className="raise-status">
          <div className="target-display">
            <span className="target-label">Current Target</span>
            <span className="target-value">{targetTricks} tricks</span>
            <span className="target-sub">to win</span>
          </div>

          <div className="raise-history">
            <p>Raises so far: {raiseCount}</p>
            {lastRaiseTeam !== null && (
              <p>Last raised by: {teamName(lastRaiseTeam)}</p>
            )}
          </div>
        </div>

        {canIRaise ? (
          <div className="raise-actions">
            <p className="your-turn-text">Your turn ({teamName(myTeam)})</p>
            <div className="raise-btns">
              <button
                className="raise-btn"
                onClick={() => onAction('raise', {})}
                disabled={targetTricks >= 13}
              >
                ⬆️ Raise to {targetTricks + 1} tricks
              </button>
              <button
                className="pass-btn"
                onClick={() => onAction('pass_raise', {})}
              >
                ✋ Pass (keep {targetTricks})
              </button>
            </div>
          </div>
        ) : (
          <div className="waiting-raise">
            <p>⏳ Waiting for {teamName(expectedTeam)} to raise or pass...</p>
          </div>
        )}

        <div className="my-cards-preview">
          <p>Your 5 cards — decide wisely!</p>
          <div className="mini-cards">
            {myCards.map(card => (
              <span
                key={card.id}
                className={`mini-card ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'}`}
              >
                {card.rank}{suitSymbol(card.suit)}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Playing Phase ──
  if (phase === 'playing') {
    const targetTeam = raiseCount % 2 === 0 ? trumpCallerTeam : dealerTeam;
    const otherTeam = targetTeam === 0 ? 1 : 0;

    return (
      <div className="game-ui courtpiece-ui playing">
        <div className="trump-info">
          <span style={{ color: SUIT_COLORS[trumpSuit] }}>
            {suitSymbol(trumpSuit)} {trumpSuit?.toUpperCase()}
          </span>
          <span className="target-info">Target: {targetTricks} tricks</span>
        </div>

        <div className="tricks-progress">
          <div className="tricks-bar">
            <div
              className="tricks-fill team-a"
              style={{ width: `${((capturedTricks?.[0] || 0) / 13) * 100}%` }}
            />
          </div>
          <div className="tricks-counts">
            <span className="team-a-count">A: {capturedTricks?.[0] || 0}</span>
            <span className="divider">|</span>
            <span className="team-b-count">B: {capturedTricks?.[1] || 0}</span>
          </div>
        </div>

        <div className="target-indicator">
          <span>
            {targetTeam === myTeam
              ? `Win ${targetTricks} tricks to win!`
              : `Stop them before ${targetTricks} tricks!`}
          </span>
        </div>
      </div>
    );
  }

  return null;
}
