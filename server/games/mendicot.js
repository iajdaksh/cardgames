const {
  createDeck, shuffleDeck, dealCards, dealRemainingCards,
  getTrickWinner, isTen
} = require('./gameEngine');

// ─── Mendicot Game ───────────────────────────────────────────────────────────
// Rules:
// - 4 players, 2 teams (0&2 vs 1&3)
// - Deal 5 cards first → play begins
// - Trump set naturally when player can't follow suit (first off-suit card played)
// - Two consecutive tricks by SAME player → collect all center cards
// - Objective: capture all four 10s (or at least 3)
// - Loser deals next

class MendicotGame {
  constructor(players) {
    // players = [{ id, name, team, position }]
    this.players = players; // position 0=South,1=West,2=North,3=East
    this.hands = {};        // playerId → cards[]
    this.trumpSuit = null;
    this.trumpSet = false;
    this.currentTrick = [];     // [{ playerId, card }]
    this.centerCards = [];      // Cards in center (not yet collected)
    this.capturedCards = { 0: [], 1: [] }; // team → cards[]
    this.lastTrickWinner = null;
    this.consecutiveWins = 0;
    this.currentLeader = null;  // playerId who leads current trick
    this.currentTurn = null;    // playerId whose turn it is
    this.dealerIndex = 0;
    this.phase = 'dealing';     // dealing | playing | finished
    this.tensCapture = { 0: 0, 1: 0 };
    this.scores = { 0: 0, 1: 0 };
    this.totalTricks = 0;
    this.remainingDeck = [];
    this.phase5Done = false;    // Whether first 5 cards have been dealt
    this.log = [];
  }

  start() {
    const deck = shuffleDeck(createDeck());
    const { hands, remainingDeck } = dealCards(deck, 4, 5, [4, 4]);

    this.remainingDeck = remainingDeck;
    this.players.forEach((p, i) => {
      this.hands[p.id] = hands[i];
    });

    // Player right of dealer leads first
    const rightOfDealer = (this.dealerIndex + 1) % 4;
    this.currentLeader = this.players[rightOfDealer].id;
    this.currentTurn = this.currentLeader;
    this.phase = 'playing_5';  // playing with first 5 cards only
    this.phase5Done = false;

    this._log(`Game started. ${this.getPlayerById(this.currentLeader)?.name} leads first.`);
  }

  handleAction(playerId, action, data) {
    if (action === 'play_card') {
      return this._playCard(playerId, data.cardId);
    }
    return null;
  }

  _playCard(playerId, cardId) {
    if (this.currentTurn !== playerId) return null;

    const hand = this.hands[playerId];
    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return null;

    // Validate: must follow suit if possible
    const card = hand[cardIndex];
    const leadSuit = this.currentTrick.length > 0 ? this.currentTrick[0].card.suit : null;

    if (leadSuit) {
      const hasSuit = hand.some(c => c.suit === leadSuit && c.id !== cardId);
      if (hasSuit && card.suit !== leadSuit) return null; // Must follow suit
    }

    // Remove card from hand
    hand.splice(cardIndex, 1);
    this.currentTrick.push({ playerId, card });

    // Check if trump is being set (first off-suit card)
    if (!this.trumpSet && leadSuit && card.suit !== leadSuit) {
      this.trumpSuit = card.suit;
      this.trumpSet = true;
      this._log(`Trump set: ${this.trumpSuit} by ${this.getPlayerById(playerId)?.name}`);

      // Deal remaining 8 cards now (4+4)
      if (!this.phase5Done) {
        this._dealRemainingCards();
        this.phase5Done = true;
      }
    }

    // If 4 cards played → resolve trick
    if (this.currentTrick.length === 4) {
      return this._resolveTrick();
    }

    // Next player's turn
    this._nextTurn();
    return { state: this.getPublicState() };
  }

  _dealRemainingCards() {
    // Deal 4+4 remaining cards
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
    this._log('Remaining cards dealt (4+4)');
  }

  _resolveTrick() {
    const leadSuit = this.currentTrick[0].card.suit;
    const winner = getTrickWinner(this.currentTrick, leadSuit, this.trumpSuit);
    const winnerPlayer = this.getPlayerById(winner.playerId);

    this._log(`Trick won by ${winnerPlayer?.name}`);
    this.totalTricks++;

    // Add trick cards to center
    this.centerCards.push(...this.currentTrick.map(t => t.card));

    // Check consecutive wins
    if (this.lastTrickWinner === winner.playerId) {
      this.consecutiveWins++;
    } else {
      this.consecutiveWins = 1;
      this.lastTrickWinner = winner.playerId;
    }

    let collected = false;
    // Collect center cards if 2 consecutive wins OR last trick
    const isLastTrick = Object.values(this.hands).every(h => h.length === 0);

    if (this.consecutiveWins >= 2 || isLastTrick) {
      const team = winnerPlayer.team;
      const tens = this.centerCards.filter(c => isTen(c));
      this.tensCapture[team] += tens.length;
      this.capturedCards[team].push(...this.centerCards);
      this.centerCards = [];
      this.consecutiveWins = 0;
      collected = true;

      // Deal remaining after trump set if not done yet
      if (!this.phase5Done && this.trumpSet) {
        this._dealRemainingCards();
        this.phase5Done = true;
      }
    }

    this.currentTrick = [];
    this.currentLeader = winner.playerId;
    this.currentTurn = winner.playerId;

    // Check game over
    if (isLastTrick) {
      return this._gameOver();
    }

    // Deal remaining cards if trump was set during first 5 tricks
    if (!this.phase5Done && this.trumpSet) {
      this._dealRemainingCards();
      this.phase5Done = true;
    }

    return { state: this.getPublicState(), collected };
  }

  _gameOver() {
    this.phase = 'finished';
    const t0Tens = this.tensCapture[0];
    const t1Tens = this.tensCapture[1];

    let winner, loserTeam, reason;

    if (t0Tens === 4) {
      winner = 0; loserTeam = 1;
      reason = 'MENDICOT! Team A captured all 4 tens!';
    } else if (t1Tens === 4) {
      winner = 1; loserTeam = 0;
      reason = 'MENDICOT! Team B captured all 4 tens!';
    } else if (t0Tens >= 3) {
      winner = 0; loserTeam = 1;
      reason = `Team A wins with ${t0Tens} tens`;
    } else if (t1Tens >= 3) {
      winner = 1; loserTeam = 0;
      reason = `Team B wins with ${t1Tens} tens`;
    } else {
      winner = null; loserTeam = null;
      reason = 'Draw! 2 tens each';
    }

    if (winner !== null) this.scores[winner]++;

    return {
      gameOver: true,
      winner: winner !== null ? `Team ${winner === 0 ? 'A' : 'B'}` : 'Draw',
      loserTeam,
      reason,
      scores: this.scores,
      tensCapture: this.tensCapture
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
      trumpSet: this.trumpSet,
      currentTurn: this.currentTurn,
      currentLeader: this.currentLeader,
      currentTrick: this.currentTrick,
      centerCardCount: this.centerCards.length,
      tensCapture: this.tensCapture,
      capturedCount: {
        0: this.capturedCards[0].length,
        1: this.capturedCards[1].length
      },
      handCounts: Object.fromEntries(
        this.players.map(p => [p.id, this.hands[p.id]?.length || 0])
      ),
      lastTrickWinner: this.lastTrickWinner,
      consecutiveWins: this.consecutiveWins,
      totalTricks: this.totalTricks,
      scores: this.scores,
      players: this.players.map(p => ({ id: p.id, name: p.name, team: p.team, position: p.position }))
    };
  }

  _log(msg) {
    this.log.push({ time: Date.now(), msg });
    console.log(`[Mendicot] ${msg}`);
  }
}

module.exports = MendicotGame;
