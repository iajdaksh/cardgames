// ─── Shared Card Engine ──────────────────────────────────────────────────────

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUE = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}_${suit}` });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function dealCards(deck, numPlayers, firstBatch, restBatches) {
  // firstBatch = 5 cards each, restBatches = [4, 4]
  const hands = Array.from({ length: numPlayers }, () => []);
  let idx = 0;

  // Deal first batch
  for (let p = 0; p < numPlayers; p++) {
    for (let c = 0; c < firstBatch; c++) {
      hands[p].push(deck[idx++]);
    }
  }

  return { hands, remainingDeck: deck.slice(idx) };
}

function dealRemainingCards(deck, hands, batches) {
  let idx = 0;
  for (const batchSize of batches) {
    for (let p = 0; p < hands.length; p++) {
      for (let c = 0; c < batchSize; c++) {
        hands[p].push(deck[idx++]);
      }
    }
  }
  return hands;
}

function cardValue(rank) {
  return RANK_VALUE[rank] || 0;
}

function compareCards(card1, card2, leadSuit, trumpSuit) {
  const c1Trump = card1.suit === trumpSuit;
  const c2Trump = card2.suit === trumpSuit;

  if (c1Trump && !c2Trump) return 1;
  if (!c1Trump && c2Trump) return -1;
  if (c1Trump && c2Trump) return cardValue(card1.rank) - cardValue(card2.rank);

  const c1Lead = card1.suit === leadSuit;
  const c2Lead = card2.suit === leadSuit;

  if (c1Lead && !c2Lead) return 1;
  if (!c1Lead && c2Lead) return -1;
  return cardValue(card1.rank) - cardValue(card2.rank);
}

function getTrickWinner(trick, leadSuit, trumpSuit) {
  // trick = [{ playerId, card }, ...]
  let winner = trick[0];
  for (let i = 1; i < trick.length; i++) {
    if (compareCards(trick[i].card, winner.card, leadSuit, trumpSuit) > 0) {
      winner = trick[i];
    }
  }
  return winner;
}

function isTen(card) {
  return card.rank === '10';
}

module.exports = {
  SUITS,
  RANKS,
  createDeck,
  shuffleDeck,
  dealCards,
  dealRemainingCards,
  cardValue,
  compareCards,
  getTrickWinner,
  isTen
};
