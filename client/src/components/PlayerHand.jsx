import React, { useState } from 'react';
import { Card } from './CardTable';

export default function PlayerHand({ cards, isMyTurn, onPlayCard, currentTrick, trumpSuit, gameState }) {
  const [selectedCard, setSelectedCard] = useState(null);

  const leadSuit = currentTrick.length > 0 ? currentTrick[0].card.suit : null;

  const isPlayable = (card) => {
    if (!isMyTurn) return false;
    if (!leadSuit) return true; // First to play, any card ok
    if (card.suit === leadSuit) return true;
    // Can only play off-suit if no lead suit cards
    return !cards.some(c => c.suit === leadSuit);
  };

  const handleCardClick = (card) => {
    if (!isMyTurn) return;
    if (!isPlayable(card)) return;

    if (selectedCard?.id === card.id) {
      // Second click = play the card
      onPlayCard(card.id);
      setSelectedCard(null);
    } else {
      setSelectedCard(card);
    }
  };

  // Sort hand: by suit then rank
  const SUIT_ORDER = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
  const RANK_ORDER = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

  const sortedCards = [...cards].sort((a, b) => {
    if (a.suit !== b.suit) return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
  });

  return (
    <div className={`player-hand ${isMyTurn ? 'my-turn' : ''}`}>
      {isMyTurn && <div className="turn-indicator">Your Turn!</div>}
      <div className="cards-row">
        {sortedCards.map((card) => {
          const playable = isPlayable(card);
          const isSelected = selectedCard?.id === card.id;
          return (
            <Card
              key={card.id}
              card={card}
              selected={isSelected}
              playable={playable}
              onClick={() => handleCardClick(card)}
            />
          );
        })}
      </div>
      {selectedCard && isMyTurn && (
        <div className="play-hint">
          Tap again to play {selectedCard.rank}{selectedCard.suit[0].toUpperCase()}
        </div>
      )}
    </div>
  );
}
