import React from 'react';

export default function MendicotUI({ gameState, myCards, player, myPosition, onAction }) {
  if (!gameState) return null;

  const { phase, trumpSuit, trumpSet, tensCapture, consecutiveWins, lastTrickWinner, centerCardCount, currentTurn } = gameState;

  const myPlayer = gameState.players?.find(p => p.id === player.id);
  const myTeam = myPlayer?.team;

  return (
    <div className="game-ui mendicot-ui">
      {/* Game status */}
      <div className="game-status">
        {phase === 'playing_5' && !trumpSet && (
          <div className="status-banner info">
            🃏 First 5 cards — Trump not set yet
          </div>
        )}
        {trumpSet && (
          <div className={`status-banner trump-set suit-${trumpSuit}`}>
            Trump: {suitEmoji(trumpSuit)} {trumpSuit?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Tens tracker */}
      <div className="tens-tracker">
        <div className="tens-row team-a-tens">
          <span>Team A</span>
          <div className="tens-display">
            {[0,1,2,3].map(i => (
              <span key={i} className={`ten-chip ${i < tensCapture?.[0] ? 'captured' : 'empty'}`}>10</span>
            ))}
          </div>
        </div>
        <div className="tens-row team-b-tens">
          <span>Team B</span>
          <div className="tens-display">
            {[0,1,2,3].map(i => (
              <span key={i} className={`ten-chip ${i < tensCapture?.[1] ? 'captured' : 'empty'}`}>10</span>
            ))}
          </div>
        </div>
      </div>

      {/* Consecutive trick tracker */}
      {consecutiveWins > 0 && (
        <div className="consecutive-banner">
          🔥 {gameState.players?.find(p => p.id === lastTrickWinner)?.name} — {consecutiveWins} trick(s) in a row
          {consecutiveWins === 1 && ' (need 2 to collect!)'}
        </div>
      )}

      {/* Center cards count */}
      {centerCardCount > 0 && (
        <div className="center-cards-info">
          🃏 {centerCardCount} cards in center
        </div>
      )}

      {/* Phase info */}
      {phase === 'playing_5' && (
        <div className="phase-info">
          Playing first 5 cards • Trump sets when someone can't follow suit
        </div>
      )}
    </div>
  );
}

function suitEmoji(suit) {
  return { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[suit] || '';
}
