const {
  createDeck, shuffleDeck, dealCards, dealRemainingCards,
  getTrickWinner
} = require('./gameEngine');

// ─── Court Piece Game ────────────────────────────────────────────────────────
// Rules:
// - 4 players, 2 teams (0&2=TeamA, 1&3=TeamB)
// - Deal 5 cards to each player first
// - Player right of dealer MUST call trump (no pass)
// - Raise round: teams can raise trick target (7→8→9→...→13), alternating
// - After raise settled → deal remaining 4+4 cards
// - Trump caller's team leads first
// - Normal trick collection (no consecutive rule)
// - Win by reaching target tricks
// - Loser deals next

class CourtPieceGame {
  constructor(players) {
    this.players = players;       // [{ id, name, team, position }]
    this.hands = {};
    this.trumpSuit = null;
    this.currentTrick = [];
    this.capturedTricks = { 0: 0, 1: 0 };
    this.currentTurn = null;
    this.currentLeader = null;
    this.dealerIndex = 0;
    this.trumpCallerIndex = null; // position of trump caller (right of dealer)
    this.trumpCallerTeam = null;
    this.dealerTeam = null;
    this.phase = 'trump_call';    // trump_call | raise | dealing_rest | playing | finished
    this.targetTricks = 7;        // starts at 7 for trump caller team
    this.raiseCount = 0;
    this.lastRaiseTeam = null;    // which team last raised
    this.scores = { 0: 0, 1: 0 };
    this.remainingDeck = [];
    this.totalTricks = 0;
    this.log = [];
  }

  start() {
    const deck = shuffleDeck(createDeck());
    const { hands, remainingDeck } = dealCards(deck, 4, 5, []);

    this.remainingDeck = remainingDeck;
    this.players.forEach((p, i) => {
      this.hands[p.id] = hands[i];
    });

    // Trump caller = right of dealer
    this.trumpCallerIndex = (this.dealerIndex + 1) % 4;
    const trumpCaller = this.players[this.trumpCallerIndex];
    this.trumpCallerTeam = trumpCaller.team;
    this.dealerTeam = this.players[this.dealerIndex].team;

    this.currentTurn = trumpCaller.id;
    this.phase = 'trump_call';

    this._log(`5 cards dealt. ${trumpCaller.name} must call trump.`);
  }

  handleAction(playerId, action, data) {
    switch (action) {
      case 'call_trump':
        return this._callTrump(playerId, data.suit);
      case 'raise':
        return this._raise(playerId);
      case 'pass_raise':
        return this._passRaise(playerId);
      case 'play_card':
        return this._playCard(playerId, data.cardId);
      default:
        return null;
    }
  }

  _callTrump(playerId, suit) {
    if (this.phase !== 'trump_call') return null;
    const caller = this.players[this.trumpCallerIndex];
    if (caller.id !== playerId) return null;
    if (!['spades', 'hearts', 'diamonds', 'clubs'].includes(suit)) return null;

    this.trumpSuit = suit;
    this.phase = 'raise';
    this.lastRaiseTeam = this.trumpCallerTeam; // trump caller just "called", dealer team raises first

    this._log(`Trump called: ${suit} by ${caller.name}`);
    return { state: this.getPublicState() };
  }

  _raise(playerId) {
    if (this.phase !== 'raise') return null;
    const player = this.getPlayerById(playerId);
    if (!player) return null;

    // Dealer team raises first, then alternates
    // Current raiser must be from opposite team of lastRaiseTeam
    const expectedTeam = this.lastRaiseTeam === this.trumpCallerTeam
      ? this.dealerTeam
      : this.trumpCallerTeam;

    if (player.team !== expectedTeam) return null;
    if (this.targetTricks >= 13) return null;

    this.targetTricks++;
    this.raiseCount++;
    this.lastRaiseTeam = player.team;

    this._log(`${player.name} raised! Target now: ${this.targetTricks} tricks`);

    if (this.targetTricks >= 13) {
      return this._startPlaying();
    }

    return { state: this.getPublicState() };
  }

  _passRaise(playerId) {
    if (this.phase !== 'raise') return null;
    const player = this.getPlayerById(playerId);
    if (!player) return null;

    const expectedTeam = this.lastRaiseTeam === this.trumpCallerTeam
      ? this.dealerTeam
      : this.trumpCallerTeam;

    // Both teams must pass (or one passes after other raised) to end raise round
    // If lastRaiseTeam already raised, other team passes → done
    this._log(`${player.name} passed raise.`);
    return this._startPlaying();
  }

  _startPlaying() {
    // Deal remaining 4+4 cards
    let idx = 0;
    const batches = [4, 4];
    for (const batchSize of batches) {
      for (const player of this.players) {
        for (let c = 0; c < batchSize; c++) {
          if (idx < this.remainingDeck.length) {
            this.hands[player.id].push(this.remainingDeck[idx++]);
          }
        }
      }
    }

    this.phase = 'playing';

    // Trump caller leads first
    const trumpCaller = this.players[this.trumpCallerIndex];
    this.currentLeader = trumpCaller.id;
    this.currentTurn = trumpCaller.id;

    this._log(`Cards dealt (4+4). Game starts! Target: ${this.targetTricks} tricks. ${trumpCaller.name} leads.`);
    return { state: this.getPublicState(), cardsDealt: true };
  }

  _playCard(playerId, cardId) {
    if (this.phase !== 'playing') return null;
    if (this.currentTurn !== playerId) return null;

    const hand = this.hands[playerId];
    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return null;

    const card = hand[cardIndex];
    const leadSuit = this.currentTrick.length > 0 ? this.currentTrick[0].card.suit : null;

    // Must follow suit
    if (leadSuit) {
      const hasSuit = hand.some(c => c.suit === leadSuit && c.id !== cardId);
      if (hasSuit && card.suit !== leadSuit) return null;
    }

    hand.splice(cardIndex, 1);
    this.currentTrick.push({ playerId, card });

    if (this.currentTrick.length === 4) {
      return this._resolveTrick();
    }

    this._nextTurn();
    return { state: this.getPublicState() };
  }

  _resolveTrick() {
    const leadSuit = this.currentTrick[0].card.suit;
    const winner = getTrickWinner(this.currentTrick, leadSuit, this.trumpSuit);
    const winnerPlayer = this.getPlayerById(winner.playerId);
    const winnerTeam = winnerPlayer.team;

    this.capturedTricks[winnerTeam]++;
    this.totalTricks++;

    this._log(`Trick ${this.totalTricks} won by ${winnerPlayer.name} (Team ${winnerTeam === 0 ? 'A' : 'B'})`);

    this.currentTrick = [];
    this.currentLeader = winner.playerId;
    this.currentTurn = winner.playerId;

    // Check win condition
    // The team that raised to current target must reach it
    // Determine which team needs targetTricks
    const targetTeam = this.raiseCount % 2 === 0 ? this.trumpCallerTeam : this.dealerTeam;
    const otherTeam = targetTeam === 0 ? 1 : 0;
    const tricksLeft = 13 - this.totalTricks;

    // Target team reaches target
    if (this.capturedTricks[targetTeam] >= this.targetTricks) {
      return this._gameOver(targetTeam, `Team ${targetTeam === 0 ? 'A' : 'B'} reached ${this.targetTricks} tricks!`);
    }

    // Other team blocks target (target team can't reach it)
    const maxPossible = this.capturedTricks[targetTeam] + tricksLeft;
    if (maxPossible < this.targetTricks) {
      return this._gameOver(otherTeam, `Team ${otherTeam === 0 ? 'A' : 'B'} blocked! Opponent can't reach ${this.targetTricks} tricks.`);
    }

    // All tricks played
    if (this.totalTricks === 13) {
      if (this.capturedTricks[targetTeam] >= this.targetTricks) {
        return this._gameOver(targetTeam, `Team ${targetTeam === 0 ? 'A' : 'B'} wins!`);
      } else {
        return this._gameOver(otherTeam, `Team ${otherTeam === 0 ? 'A' : 'B'} wins by blocking!`);
      }
    }

    return { state: this.getPublicState() };
  }

  _gameOver(winnerTeam, reason) {
    this.phase = 'finished';
    this.scores[winnerTeam]++;
    const loserTeam = winnerTeam === 0 ? 1 : 0;

    // Check for Court (Kot) - winning all 13 tricks
    const isKot = this.capturedTricks[winnerTeam] === 13;

    return {
      gameOver: true,
      winner: `Team ${winnerTeam === 0 ? 'A' : 'B'}`,
      loserTeam,
      reason: isKot ? `KOT! ${reason}` : reason,
      isKot,
      scores: this.scores,
      capturedTricks: this.capturedTricks,
      targetTricks: this.targetTricks
    };
  }

  _nextTurn() {
    const currentIdx = this.players.findIndex(p => p.id === this.currentTurn);
    this.currentTurn = this.players[(currentIdx + 1) % 4].id;
  }

  getPlayerById(id) {
    return this.players.find(p => p.id === id);
  }

  getPlayerCards(playerId) {
    return this.hands[playerId] || [];
  }

  getPlayerPosition(playerId) {
    return this.players.find(p => p.id === playerId)?.position;
  }

  getPublicState() {
    return {
      phase: this.phase,
      trumpSuit: this.trumpSuit,
      currentTurn: this.currentTurn,
      currentLeader: this.currentLeader,
      currentTrick: this.currentTrick,
      capturedTricks: this.capturedTricks,
      targetTricks: this.targetTricks,
      raiseCount: this.raiseCount,
      lastRaiseTeam: this.lastRaiseTeam,
      trumpCallerTeam: this.trumpCallerTeam,
      dealerTeam: this.dealerTeam,
      trumpCallerIndex: this.trumpCallerIndex,
      handCounts: Object.fromEntries(
        this.players.map(p => [p.id, this.hands[p.id]?.length || 0])
      ),
      totalTricks: this.totalTricks,
      scores: this.scores,
      players: this.players.map(p => ({ id: p.id, name: p.name, team: p.team, position: p.position }))
    };
  }

  _log(msg) {
    this.log.push({ time: Date.now(), msg });
    console.log(`[CourtPiece] ${msg}`);
  }
}

module.exports = CourtPieceGame;
