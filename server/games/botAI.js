// ─── Bot AI Engine ───────────────────────────────────────────────────────────
// Smart bot decisions for Mendicot and Court Piece

const { SUITS, cardValue, compareCards } = require('./gameEngine');

const BOT_NAMES = [
  'Arjun🤖', 'Priya🤖', 'Ravi🤖', 'Meena🤖',
  'Vikram🤖', 'Deepa🤖', 'Suresh🤖', 'Kavya🤖'
];

let botNameIndex = 0;
function getNextBotName() {
  return BOT_NAMES[botNameIndex++ % BOT_NAMES.length];
}

// ─── SHARED BOT LOGIC ────────────────────────────────────────────────────────

/**
 * Pick best card to play given the game state
 * Strategy:
 * - Follow suit if possible: play lowest winning card or dump lowest card
 * - Can't follow: play lowest trump if winning is useful, else dump lowest
 */
function botPickCard(hand, currentTrick, trumpSuit, gameType, teamInfo) {
  if (!hand || hand.length === 0) return null;

  const leadSuit = currentTrick.length > 0 ? currentTrick[0].card.suit : null;

  // First to play → lead strategy
  if (!leadSuit) {
    return botLead(hand, trumpSuit, gameType, teamInfo);
  }

  // Can follow suit?
  const suitCards = hand.filter(c => c.suit === leadSuit);
  if (suitCards.length > 0) {
    return botFollowSuit(suitCards, hand, currentTrick, leadSuit, trumpSuit, gameType, teamInfo);
  }

  // Can't follow → play trump or discard
  return botDiscardOrTrump(hand, currentTrick, leadSuit, trumpSuit, gameType, teamInfo);
}

function botLead(hand, trumpSuit, gameType, teamInfo) {
  // Mendicot: try to lead tens if we have them and partner might win
  if (gameType === 'mendicot') {
    const tens = hand.filter(c => c.rank === '10');
    if (tens.length > 0 && Math.random() > 0.5) return tens[0];
  }

  // Lead with highest non-trump card
  const nonTrump = hand.filter(c => c.suit !== trumpSuit);
  if (nonTrump.length > 0) {
    return nonTrump.reduce((best, c) => cardValue(c.rank) > cardValue(best.rank) ? c : best);
  }

  // All trump → lead lowest trump
  return hand.reduce((best, c) => cardValue(c.rank) < cardValue(best.rank) ? c : best);
}

function botFollowSuit(suitCards, hand, currentTrick, leadSuit, trumpSuit, gameType, teamInfo) {
  const currentWinner = getCurrentTrickWinner(currentTrick, leadSuit, trumpSuit);
  const partnerWinning = currentWinner && teamInfo && currentWinner.team === teamInfo.myTeam;

  if (partnerWinning) {
    // Partner is winning → dump lowest card
    return suitCards.reduce((low, c) => cardValue(c.rank) < cardValue(low.rank) ? c : low);
  }

  // Try to win: play lowest winning card
  const winningCards = suitCards.filter(c =>
    currentTrick.every(t => compareCards(c, t.card, leadSuit, trumpSuit) > 0)
  );

  if (winningCards.length > 0) {
    // For mendicot: if a ten is at risk in center, try to win
    if (gameType === 'mendicot') {
      const centerHasTen = currentTrick.some(t => t.card.rank === '10');
      if (centerHasTen) {
        return winningCards.reduce((high, c) => cardValue(c.rank) > cardValue(high.rank) ? c : high);
      }
    }
    return winningCards.reduce((low, c) => cardValue(c.rank) < cardValue(low.rank) ? c : low);
  }

  // Can't win → dump lowest
  return suitCards.reduce((low, c) => cardValue(c.rank) < cardValue(low.rank) ? c : low);
}

function botDiscardOrTrump(hand, currentTrick, leadSuit, trumpSuit, gameType, teamInfo) {
  const trumpCards = hand.filter(c => c.suit === trumpSuit);
  const nonTrump = hand.filter(c => c.suit !== trumpSuit && c.suit !== leadSuit);
  const currentWinner = getCurrentTrickWinner(currentTrick, leadSuit, trumpSuit);
  const partnerWinning = currentWinner && teamInfo && currentWinner.team === teamInfo.myTeam;

  if (partnerWinning) {
    // Partner winning → dump lowest non-trump
    const dump = nonTrump.length > 0 ? nonTrump : hand;
    return dump.reduce((low, c) => cardValue(c.rank) < cardValue(low.rank) ? c : low);
  }

  // Should we play trump?
  if (trumpCards.length > 0) {
    // Play lowest trump that wins
    const winningTrumps = trumpCards.filter(c =>
      !currentTrick.some(t => t.card.suit === trumpSuit && cardValue(t.card.rank) > cardValue(c.rank))
    );
    if (winningTrumps.length > 0) {
      return winningTrumps.reduce((low, c) => cardValue(c.rank) < cardValue(low.rank) ? c : low);
    }
  }

  // Dump lowest card (avoid dumping tens if possible)
  const nonTens = hand.filter(c => c.rank !== '10' && c.suit !== trumpSuit);
  const pool = nonTens.length > 0 ? nonTens : hand;
  return pool.reduce((low, c) => cardValue(c.rank) < cardValue(low.rank) ? c : low);
}

function getCurrentTrickWinner(trick, leadSuit, trumpSuit) {
  if (!trick || trick.length === 0) return null;
  let winner = trick[0];
  for (let i = 1; i < trick.length; i++) {
    if (compareCards(trick[i].card, winner.card, leadSuit, trumpSuit) > 0) {
      winner = trick[i];
    }
  }
  return winner;
}

// ─── COURT PIECE BOT: Trump Call ─────────────────────────────────────────────
function botCallTrump(hand) {
  // Count cards per suit, weight by card strength
  const suitScore = {};
  for (const suit of SUITS) {
    const suitCards = hand.filter(c => c.suit === suit);
    const score = suitCards.reduce((s, c) => s + cardValue(c.rank), 0);
    suitScore[suit] = score;
  }
  // Pick suit with highest score
  return Object.entries(suitScore).reduce((best, [suit, score]) =>
    score > best[1] ? [suit, score] : best
  )[0];
}

// ─── COURT PIECE BOT: Raise Decision ─────────────────────────────────────────
function botDecideRaise(hand, trumpSuit, currentTarget) {
  if (currentTarget >= 12) return false; // Never raise to 13 unless very strong

  // Count trump cards and high cards
  const trumpCards = hand.filter(c => c.suit === trumpSuit);
  const highCards = hand.filter(c => ['A', 'K', 'Q'].includes(c.rank));
  const strength = trumpCards.length * 2 + highCards.length;

  // Raise if hand is strong enough for new target
  const threshold = currentTarget >= 10 ? 12 : currentTarget >= 8 ? 9 : 7;
  return strength >= threshold;
}

// ─── CREATE BOT PLAYER ───────────────────────────────────────────────────────
function createBot(position) {
  const team = position % 2 === 0 ? 0 : 1;
  return {
    id: `bot_${position}_${Date.now()}`,
    name: getNextBotName(),
    team,
    position,
    isBot: true,
    isOnline: true
  };
}

module.exports = {
  botPickCard,
  botCallTrump,
  botDecideRaise,
  createBot,
  getNextBotName
};
