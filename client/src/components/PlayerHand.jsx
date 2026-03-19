import React, { useState } from 'react';

const getCardImage = (card) => {
  const rankMap = { 'A':'ace','K':'king','Q':'queen','J':'jack','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','10':'10' };
  return `/cards/${rankMap[card.rank]}_of_${card.suit}.png`;
};

const SUIT_ORDER = { spades:0, hearts:1, diamonds:2, clubs:3 };
const RANK_ORDER = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};

export default function PlayerHand({ cards, isMyTurn, onPlayCard, currentTrick, trumpSuit }) {
  const [selected, setSelected] = useState(null);
  const leadSuit = currentTrick?.length > 0 ? currentTrick[0].card.suit : null;
  const hasSuit = leadSuit ? cards.some(c => c.suit === leadSuit) : false;

  const isPlayable = (card) => {
    if (!isMyTurn) return false;
    if (!leadSuit) return true;
    if (hasSuit) return card.suit === leadSuit;
    return true;
  };

  const handleClick = (card) => {
    if (!isPlayable(card)) return;
    if (selected === card.id) { onPlayCard(card.id); setSelected(null); }
    else setSelected(card.id);
  };

  const sorted = [...cards].sort((a,b) => {
    if (a.suit !== b.suit) return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
  });

  return (
    <div className="player-hand">
      {isMyTurn && <div className="turn-chip">🎯 Tap card once to select, again to play</div>}
      <div className="cards-row-img">
        {sorted.map((card, i) => {
          const playable = isPlayable(card);
          const sel = selected === card.id;
          return (
            <div
              key={card.id}
              className={`card-img-wrap ${sel?'selected':''} ${playable?'playable':'not-playable'}`}
              style={{ marginLeft: i===0?0:-28, zIndex: sel?50:i }}
              onClick={() => handleClick(card)}
            >
              <img src={getCardImage(card)} alt={`${card.rank} of ${card.suit}`} className="card-img" draggable={false} />
              {sel && <div className="card-glow"/>}
            </div>
          );
        })}
      </div>
      {selected && isMyTurn && <div className="play-hint">👆 Tap again to play!</div>}
    </div>
  );
}
