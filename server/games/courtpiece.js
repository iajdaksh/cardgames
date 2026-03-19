const {
  createDeck, shuffleDeck, dealCards, dealRemainingCards,
  getTrickWinner, cardValue
} = require('./gameEngine');

class CourtPieceGame {
  constructor(players) {
    this.players = players;
    this.hands = {};
    this.trumpSuit = null;
    this.targetTricks = 7;
    this.currentTurn = null;
    this.currentTrick = [];
    this.capturedTricks = { 0: 0, 1: 0 };
    this.phase = 'dealing';
    this.remainingDeck = [];
    this.dealerIndex = 0;
    this.trumpCallerIndex = null;  // who called trump first
    this.lastTrumpTeam = null;     // team who last chose trump
    this.lastTrumpPlayer = null;   // player who last chose trump
    this.raiseCount = 0;
    this.lastRaiseTeam = null;
    this.passCount = 0;            // consecutive passes
    this.scores = { 0: 0, 1: 0 };
    this.log = [];
  }

  start() {
    const deck = shuffleDeck(createDeck());
    const { hands, remainingDeck } = dealCards(deck, 4, 5, []);
    this.remainingDeck = remainingDeck;
    this.players.forEach((p, i) => { this.hands[p.id] = hands[i]; });

    // Player next to dealer calls trump
    this.trumpCallerIndex = (this.dealerIndex + 1) % 4;
    this.currentTurn = this.players[this.trumpCallerIndex].id;
    this.phase = 'trump_call';
    this._log(`Game started. ${this.players[this.trumpCallerIndex].name} calls trump.`);
  }

  handleAction(playerId, action, data) {
    if (action === 'call_trump') return this._callTrump(playerId, data.suit);
    if (action === 'raise') return this._raise(playerId, data.suit);
    if (action === 'pass_raise') return this._passRaise(playerId);
    if (action === 'play_card') return this._playCard(playerId, data.cardId);
    return null;
  }

  // ── Trump Call (first call by player next to dealer) ──────────────────────
  _callTrump(playerId, suit) {
    if (this.currentTurn !== playerId) return null;
    if (this.phase !== 'trump_call') return null;

    this.trumpSuit = suit;
    this.lastTrumpTeam = this.getPlayerById(playerId).team;
    this.lastTrumpPlayer = playerId;
    this.targetTricks = 7;
    this.raiseCount = 0;
    this.passCount = 0;

    this._log(`Trump called: ${suit} by ${this.getPlayerById(playerId).name}`);

    // Move to raise phase — opponent team goes first
    const callerTeam = this.getPlayerById(playerId).team;
    const opponentTeam = callerTeam === 0 ? 1 : 0;
    this.lastRaiseTeam = callerTeam; // caller just "raised" (called trump)
    
    // Find opponent team player to raise/pass
    const opponentPlayer = this.players.find(p => p.team === opponentTeam);
    this.currentTurn = opponentPlayer.id;
    this.phase = 'raise';

    return { state: this.getPublicState() };
  }

  // ── Raise (change/keep trump, target +1) ──────────────────────────────────
  _raise(playerId, newSuit) {
    if (this.phase !== 'raise') return null;
    if (this.currentTurn !== playerId) return null;
    if (this.targetTricks >= 13) return null;

    const player = this.getPlayerById(playerId);
    
    // Update trump (can be same or new suit)
    this.trumpSuit = newSuit || this.trumpSuit;
    this.targetTricks++;
    this.raiseCount++;
    this.lastRaiseTeam = player.team;
    this.lastTrumpTeam = player.team;
    this.lastTrumpPlayer = playerId;
    this.passCount = 0;

    this._log(`${player.name} raised to ${this.targetTricks} tricks, trump: ${this.trumpSuit}`);

    // Switch to other team
    const otherTeam = player.team === 0 ? 1 : 0;
    const otherPlayer = this.players.find(p => p.team === otherTeam && p.id !== this.lastTrumpPlayer) 
      || this.players.find(p => p.team === otherTeam);
    this.currentTurn = otherPlayer.id;

    return { state: this.getPublicState() };
  }

  // ── Pass Raise ────────────────────────────────────────────────────────────
  _passRaise(playerId) {
    if (this.phase !== 'raise') return null;
    if (this.currentTurn !== playerId) return null;

    const player = this.getPlayerById(playerId);
    this.passCount++;
    this._log(`${player.name} passed raise`);

    if (this.passCount >= 2) {
      // Both teams passed → start game
      return this._startPlaying();
    }

    // Switch to other team
    const otherTeam = player.team === 0 ? 1 : 0;
    const otherPlayer = this.players.find(p => p.team === otherTeam);
    this.currentTurn = otherPlayer.id;
    this.passCount = this.passCount; // keep counting

    return { state: this.getPublicState() };
  }

  // ── Start Playing ─────────────────────────────────────────────────────────
  _startPlaying() {
    // Deal remaining cards
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
    // Last trump chooser leads first
    this.currentTurn = this.lastTrumpPlayer;
    this._log(`Game starts! ${this.getPlayerById(this.lastTrumpPlayer).name} leads. Target: ${this.targetTricks} tricks. Trump: ${this.trumpSuit}`);

    return { state: this.getPublicState(), cardsDealt: true };
  }

  // ── Play Card ─────────────────────────────────────────────────────────────
  _playCard(playerId, cardId) {
    if (this.phase !== 'playing') return null;
    if (this.currentTurn !== playerId) return null;

    const hand = this.hands[playerId];
    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return null;

    const card = hand[cardIndex];
    const leadSuit = this.currentTrick.length > 0 ? this.currentTrick[0].card.suit : null;

    // Validate follow suit
    if (leadSuit) {
      const hasSuit = hand.some(c => c.suit === leadSuit && c.id !== cardId);
      if (hasSuit && card.suit !== leadSuit) return null;
    }

    // Remove card from hand
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
    this._log(`Trick ${this.capturedTricks[0]+this.capturedTricks[1]} won by ${winnerPlayer.name} (Team ${winnerTeam === 0 ? 'A' : 'B'})`);

    this.currentTrick = [];
    this.currentTurn = winner.playerId;

    const totalTricks = this.capturedTricks[0] + this.capturedTricks[1];

    // Check early win — trump team got target
    const trumpTeam = this.lastTrumpTeam;
    const otherTeam = trumpTeam === 0 ? 1 : 0;

    if (this.capturedTricks[trumpTeam] >= this.targetTricks) {
      return this._gameOver(trumpTeam);
    }

    // Check if other team blocked
    const tricksLeft = 13 - totalTricks;
    if (this.capturedTricks[otherTeam] > 13 - this.targetTricks) {
      return this._gameOver(otherTeam);
    }

    if (totalTricks >= 13) {
      // All tricks played
      const trumpWon = this.capturedTricks[trumpTeam] >= this.targetTricks;
      return this._gameOver(trumpWon ? trumpTeam : otherTeam);
    }

    return { state: this.getPublicState() };
  }

  _gameOver(winnerTeam) {
    this.phase = 'finished';
    const loserTeam = winnerTeam === 0 ? 1 : 0;
    const isSuper = this.capturedTricks[winnerTeam] === 13;

    // Scoring based on target
    const pts = this.targetTricks === 13 ? 7 : this.targetTricks - 6;
    this.scores[winnerTeam] += pts;

    const reason = isSuper
      ? `🏆 SUPER WIN! Team ${winnerTeam === 0 ? 'A' : 'B'} won all 13 tricks!`
      : `Team ${winnerTeam === 0 ? 'A' : 'B'} won ${this.capturedTricks[winnerTeam]}/${this.targetTricks} tricks`;

    this._log(`Game over! ${reason}`);

    return {
      gameOver: true,
      winner: `Team ${winnerTeam === 0 ? 'A' : 'B'}`,
      loserTeam,
      reason,
      scores: this.scores,
      isKot: isSuper,
      capturedTricks: this.capturedTricks
    };
  }

  _nextTurn() {
    const idx = this.players.findIndex(p => p.id === this.currentTurn);
    this.currentTurn = this.players[(idx + 1) % 4].id;
  }

  getPlayerById(id) { return this.players.find(p => p.id === id); }
  getPlayerCards(playerId) { return this.hands[playerId] || []; }
  getPlayerPosition(playerId) { return this.players.find(p => p.id === playerId)?.position; }

  getPublicState() {
    return {
      phase: this.phase,
      trumpSuit: this.trumpSuit,
      targetTricks: this.targetTricks,
      raiseCount: this.raiseCount,
      lastRaiseTeam: this.lastRaiseTeam,
      lastTrumpTeam: this.lastTrumpTeam,
      trumpCallerIndex: this.trumpCallerIndex,
      currentTurn: this.currentTurn,
      currentTrick: this.currentTrick,
      capturedTricks: this.capturedTricks,
      handCounts: Object.fromEntries(
        this.players.map(p => [p.id, this.hands[p.id]?.length || 0])
      ),
      scores: this.scores,
      passCount: this.passCount,
      players: this.players.map(p => ({
        id: p.id, name: p.name, team: p.team, position: p.position
      }))
    };
  }

  _log(msg) {
    this.log.push({ time: Date.now(), msg });
    console.log(`[CourtPiece] ${msg}`);
  }
}

module.exports = CourtPieceGame;
