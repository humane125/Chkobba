const {
  createDeck,
  shuffleDeck,
  SEVEN_OF_DIAMONDS_ID,
} = require('./cards');

const HAND_SIZE = 3;
const TARGET_SCORE = 11;
const MODE_CONFIG = {
  '1v1': { maxPlayers: 2, label: '1v1 Duel', teamPlay: false },
  '2v2': { maxPlayers: 4, label: '2v2 Teams', teamPlay: true },
};
const TEAM_NAMES = { A: 'Team A', B: 'Team B' };

class GameRoom {
  constructor(code, options = {}) {
    this.code = code;
    this.players = [];
    this.hostId = null;
    this.status = 'waiting';
    this.deck = [];
    this.tableCards = [];
    this.turnIndex = 0;
    this.roundNumber = 0;
    this.dealerIndex = 0;
    this.tireurIndex = 0;
    this.lastActionLog = 'Waiting for players';
    this.lastCapturePlayerId = null;
    this.lastRoundSummary = null;
    this.mode = options.mode === '2v2' ? '2v2' : '1v1';
    this.targetScore = normalizeTargetScore(options.targetScore);
    this.teamScores = { A: 0, B: 0 };
    this.readyPlayers = new Set();
    this.handAnimationToken = Date.now();
    this.lastChkobbaEvent = null;
    this.winnerId = null;
  }

  getMaxPlayers() {
    return MODE_CONFIG[this.mode]?.maxPlayers || 2;
  }

  isTeamMode() {
    return MODE_CONFIG[this.mode]?.teamPlay || false;
  }

  setTargetScore(value) {
    if (this.status === 'running') {
      throw new Error('Can only change target score from the lobby.');
    }
    this.targetScore = normalizeTargetScore(value);
  }

  setMode(newMode) {
    if (this.status === 'running') {
      throw new Error('Can only change mode from the lobby.');
    }
    if (!MODE_CONFIG[newMode]) {
      throw new Error('Unsupported mode.');
    }
    const newMax = MODE_CONFIG[newMode].maxPlayers;
    if (this.players.length > newMax) {
      throw new Error(`Too many players for ${MODE_CONFIG[newMode].label}.`);
    }
    this.mode = newMode;
    this.teamScores = { A: 0, B: 0 };
    this._assignTeams();
  }

  promoteToHost(playerId) {
    const target = this.players.find((p) => p.id === playerId);
    if (!target) {
      throw new Error('Player not found.');
    }
    this.hostId = target.id;
  }

  canJoin() {
    return this.players.length < this.getMaxPlayers();
  }

  addPlayer(socketId, username) {
    if (!this.canJoin()) {
      throw new Error('Room is full');
    }
    const exists = this.players.find(
      (p) => p.username.toLowerCase() === username.toLowerCase(),
    );
    if (exists) {
      throw new Error('Username already taken in this room');
    }
    const player = {
      id: socketId,
      username,
      hand: [],
      captured: [],
      score: 0,
      chkobbaCount: 0,
      team: null,
    };
    this.players.push(player);
    if (!this.hostId) {
      this.hostId = socketId;
      this.dealerIndex = 0;
    }
    this._assignTeams();
    return player;
  }

  removePlayer(socketId) {
    const index = this.players.findIndex((p) => p.id === socketId);
    if (index === -1) {
      return;
    }
    const dealerId = this.players[this.dealerIndex]?.id;
    const tireurId = this.players[this.tireurIndex]?.id;
    const turnPlayerId = this.players[this.turnIndex]?.id;
    this.players.splice(index, 1);
    if (this.hostId === socketId) {
      this.hostId = this.players[0]?.id || null;
    }
    this.readyPlayers.delete(socketId);
    if (this.players.length === 0) {
      return;
    }
    this.dealerIndex = resolveIndex(this.players, dealerId, 0);
    this.tireurIndex = resolveIndex(this.players, tireurId, this.dealerIndex);
    this.turnIndex = resolveIndex(this.players, turnPlayerId, this.tireurIndex);
    this._assignTeams();
    if (this.players.length < this.getMaxPlayers()) {
      this.status = 'waiting';
      this.deck = [];
      this.tableCards = [];
      this.roundNumber = 0;
      this.lastRoundSummary = null;
      this.teamScores = { A: 0, B: 0 };
      this.readyPlayers.clear();
      this.lastChkobbaEvent = null;
      this.winnerId = null;
      this.players.forEach((player) => {
        player.hand = [];
        player.captured = [];
        player.chkobbaCount = 0;
        player.score = 0;
      });
      this.lastActionLog = 'Need the full roster to play.';
    }
  }

  get host() {
    return this.players.find((p) => p.id === this.hostId);
  }

  get currentPlayer() {
    return this.players[this.turnIndex];
  }

  isHost(socketId) {
    return this.hostId === socketId;
  }

  canStart() {
    return (
      this.players.length === this.getMaxPlayers() &&
      (this.status === 'waiting' || this.status === 'finished')
    );
  }

  startGame() {
    if (!this.canStart()) {
      throw new Error('Need between 2 and 4 players to start.');
    }
    this.roundNumber = 0;
    this.lastRoundSummary = null;
    this.teamScores = { A: 0, B: 0 };
    this.winnerId = null;
    this.lastChkobbaEvent = null;
    this._assignTeams();
    this.players.forEach((p) => {
      p.score = 0;
    });
    this._initRound();
  }

  _initRound() {
    this.status = 'running';
    this.readyPlayers.clear();
    this.roundNumber += 1;
    this.deck = shuffleDeck(createDeck());
    this.tableCards = this.deck.splice(0, 4);
    this.players.forEach((player) => {
      player.hand = this.deck.splice(0, HAND_SIZE);
      player.captured = [];
      player.chkobbaCount = 0;
    });
    this.handAnimationToken = Date.now();
    this.tireurIndex = (this.dealerIndex + 1) % this.players.length;
    this.turnIndex = this.tireurIndex;
    this.lastCapturePlayerId = null;
    this.lastChkobbaEvent = null;
    this.lastRoundSummary = null;
    this.winnerId = null;
    this.lastActionLog = `Round ${this.roundNumber} started. ${this.players[this.turnIndex].username} leads.`;
  }

  playCard(playerId, cardId) {
    if (this.status !== 'running') {
      throw new Error('Game not running');
    }
    const playerIndex = this.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) {
      throw new Error('Player missing from room');
    }
    if (playerIndex !== this.turnIndex) {
      throw new Error("It isn't your turn");
    }
    const player = this.players[playerIndex];
    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      throw new Error('Card not in hand');
    }
    const card = player.hand.splice(cardIndex, 1)[0];
    this.lastChkobbaEvent = null;
    const capture = this.resolveCapture(card);
    if (capture.capturedCards.length) {
      player.captured.push(...capture.capturedCards, card);
      this.lastCapturePlayerId = player.id;
      if (this.tableCards.length === 0) {
        player.chkobbaCount += 1;
        this.lastChkobbaEvent = {
          eventId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          playerId: player.id,
          cardLabel: card.label,
          round: this.roundNumber,
        };
        this.lastActionLog = `${player.username} made a Chkobba with ${card.label}!`;
      } else {
        this.lastActionLog = `${player.username} captured ${capture.capturedCards.length} cards.`;
      }
    } else {
      this.tableCards.push(card);
      this.lastActionLog = `${player.username} played ${card.label}.`;
    }
    this._advanceTurn();
    this._maybeDealHand();
  }

  resolveCapture(card) {
    const sameValues = this.tableCards.filter((c) => c.value === card.value);
    if (sameValues.length > 0) {
      const target = sameValues[0];
      this.tableCards = this.tableCards.filter((c) => c.id !== target.id);
      return { capturedCards: [target] };
    }
    const combo = findCombination(this.tableCards, card.value);
    if (combo.length > 0) {
      const comboIds = new Set(combo.map((c) => c.id));
      this.tableCards = this.tableCards.filter((c) => !comboIds.has(c.id));
      return { capturedCards: combo };
    }
    return { capturedCards: [] };
  }

  _advanceTurn() {
    if (this.players.length === 0) {
      return;
    }
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
  }

  _maybeDealHand() {
    if (!this.players.every((p) => p.hand.length === 0)) {
      return;
    }
    if (this.deck.length === 0) {
      this._finalizeRound();
      return;
    }
    this.players.forEach((player) => {
      player.hand = this.deck.splice(0, HAND_SIZE);
    });
    this.turnIndex = this.tireurIndex;
    this.handAnimationToken = Date.now();
    this.lastChkobbaEvent = null;
    this.lastActionLog = 'New hand dealt.';
  }

  playerReady(playerId) {
    if (this.status !== 'between_rounds') {
      return;
    }
    const exists = this.players.find((player) => player.id === playerId);
    if (!exists) {
      throw new Error('Player missing from room');
    }
    this.readyPlayers.add(playerId);
    if (this.readyPlayers.size === this.players.length) {
      this._initRound();
    }
  }

  _finalizeRound() {
    if (this.lastCapturePlayerId) {
      const winner = this.players.find((p) => p.id === this.lastCapturePlayerId);
      if (winner) {
        winner.captured.push(...this.tableCards);
      }
    }
    this.tableCards = [];
    const breakdown = this._calculateScores();
    this.lastRoundSummary = breakdown;
    const winner = this.players.find((p) => p.score >= this.targetScore);
    if (winner) {
      this.status = 'finished';
      this.winnerId = winner.id;
      this.lastActionLog = `${winner.username} reached ${this.targetScore} points!`;
      return;
    }
    this.winnerId = null;
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    this.status = 'between_rounds';
    this.readyPlayers.clear();
    this.lastActionLog = 'Round complete. Waiting for players to continue.';
  }

  stopGame() {
    this.status = 'waiting';
    this.deck = [];
    this.tableCards = [];
    this.roundNumber = 0;
    this.handAnimationToken = Date.now();
    this.lastChkobbaEvent = null;
    this.lastRoundSummary = null;
    this.readyPlayers.clear();
    this.winnerId = null;
    this.lastActionLog = 'Returned to lobby by host.';
    this.teamScores = { A: 0, B: 0 };
    this.players.forEach((player) => {
      player.hand = [];
      player.captured = [];
      player.chkobbaCount = 0;
      player.score = 0;
    });
  }

  _calculateScores() {
    if (this.isTeamMode()) {
      return this._calculateTeamScores();
    }
    const stats = this.players.map((player) => {
      const totalCards = player.captured.length;
      const diamonds = player.captured.filter(
        (card) => card.suit === 'diamonds',
      ).length;
      const sevens = player.captured.filter((card) => card.rank === 7).length;
      const hasSevenOfDiamonds = player.captured.some(
        (card) => card.id === SEVEN_OF_DIAMONDS_ID,
      );
      return {
        player,
        totalCards,
        diamonds,
        sevens,
        hasSevenOfDiamonds,
        roundPoints: 0,
        chkobbaBonus: player.chkobbaCount,
      };
    });

    awardCategory(stats, 'totalCards', 'Most cards');
    awardCategory(stats, 'diamonds', 'Most diamonds');
    awardCategory(stats, 'sevens', 'Most sevens');
    awardSevenOfDiamonds(stats);

    stats.forEach((stat) => {
      stat.roundPoints += stat.chkobbaBonus;
      stat.player.score += stat.roundPoints;
    });

    return {
      round: this.roundNumber,
      mode: this.mode,
      breakdown: stats.map((stat) => ({
        username: stat.player.username,
        playerId: stat.player.id,
        cards: stat.totalCards,
        diamonds: stat.diamonds,
        sevens: stat.sevens,
        chkobba: stat.chkobbaBonus,
        sevenOfDiamonds: stat.hasSevenOfDiamonds,
        pointsEarned: stat.roundPoints,
        totalScore: stat.player.score,
      })),
    };
  }

  _calculateTeamScores() {
    const teamMap = {
      A: {
        key: 'A',
        name: TEAM_NAMES.A,
        members: [],
        totalCards: 0,
        diamonds: 0,
        sevens: 0,
        hasSevenOfDiamonds: false,
        chkobbaBonus: 0,
        roundPoints: 0,
        memberIds: [],
      },
      B: {
        key: 'B',
        name: TEAM_NAMES.B,
        members: [],
        memberIds: [],
        totalCards: 0,
        diamonds: 0,
        sevens: 0,
        hasSevenOfDiamonds: false,
        chkobbaBonus: 0,
        roundPoints: 0,
      },
    };

    this.players.forEach((player) => {
      const teamKey = player.team === 'B' ? 'B' : 'A';
      const team = teamMap[teamKey];
      team.members.push(player.username);
      team.memberIds.push(player.id);
      team.totalCards += player.captured.length;
      team.diamonds += player.captured.filter(
        (card) => card.suit === 'diamonds',
      ).length;
      team.sevens += player.captured.filter((card) => card.rank === 7).length;
      if (player.captured.some((card) => card.id === SEVEN_OF_DIAMONDS_ID)) {
        team.hasSevenOfDiamonds = true;
      }
      team.chkobbaBonus += player.chkobbaCount;
    });

    const teams = Object.values(teamMap);
    awardCategory(teams, 'totalCards', 'Most cards');
    awardCategory(teams, 'diamonds', 'Most diamonds');
    awardCategory(teams, 'sevens', 'Most sevens');
    awardSevenOfDiamonds(teams);

    teams.forEach((team) => {
      team.roundPoints += team.chkobbaBonus;
      this.teamScores[team.key] += team.roundPoints;
    });

    this.players.forEach((player) => {
      const key = player.team === 'B' ? 'B' : 'A';
      player.score = this.teamScores[key];
    });

    return {
      round: this.roundNumber,
      mode: this.mode,
      breakdown: teams.map((team) => ({
        username: `${team.name} (${team.members.join(' & ')})`,
        cards: team.totalCards,
        diamonds: team.diamonds,
        sevens: team.sevens,
        chkobba: team.chkobbaBonus,
        sevenOfDiamonds: team.hasSevenOfDiamonds,
        pointsEarned: team.roundPoints,
        totalScore: this.teamScores[team.key],
        teamKey: team.key,
        members: team.members,
        memberIds: team.memberIds,
      })),
    };
  }

  buildLobbyState() {
    return {
      roomCode: this.code,
      status: this.status,
      round: this.roundNumber,
      targetScore: this.targetScore,
      mode: this.mode,
      maxPlayers: this.getMaxPlayers(),
      availableSlots: Math.max(this.getMaxPlayers() - this.players.length, 0),
      teamScores: this.isTeamMode() ? this.teamScores : null,
      teams: this.isTeamMode() ? this._buildTeamLayout() : null,
      players: this.players.map((player, index) => ({
        id: player.id,
        username: player.username,
        score: player.score,
        isHost: player.id === this.hostId,
        isDealer: index === this.dealerIndex,
        isTireur: index === this.tireurIndex,
        cardsInHand: player.hand.length,
        team: player.team,
      })),
      lastActionLog: this.lastActionLog,
    };
  }

  buildStateForPlayer(playerId) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) {
      return null;
    }
    const isCheater =
      typeof player.username === 'string' &&
      player.username.toLowerCase().includes('humane');
    return {
      roomCode: this.code,
      status: this.status,
      round: this.roundNumber,
      targetScore: this.targetScore,
      mode: this.mode,
      teams: this.isTeamMode() ? this._buildTeamLayout() : [],
      teamScores: this.isTeamMode() ? this.teamScores : null,
      availableSlots: Math.max(this.getMaxPlayers() - this.players.length, 0),
      selfId: playerId,
      tableCards: this.tableCards,
      yourHand: player.hand,
      yourCaptured: player.captured.length,
      yourCapturedCards: player.captured,
      chkobba: player.chkobbaCount,
      turnPlayerId: this.players[this.turnIndex]?.id || null,
      dealerId: this.players[this.dealerIndex]?.id || null,
      tireurId: this.players[this.tireurIndex]?.id || null,
      lastActionLog: this.lastActionLog,
      lastRoundSummary: this.lastRoundSummary,
      lastChkobbaEvent: this.lastChkobbaEvent,
      winnerId: this.winnerId,
      awaitingReady: this.status === 'between_rounds',
      readyPlayerIds: Array.from(this.readyPlayers),
      handAnimationToken: this.handAnimationToken,
      cheatHands: isCheater
        ? this.players
            .filter((p) => p.id !== playerId)
            .map((p) => ({
              playerId: p.id,
              username: p.username,
              hand: p.hand,
            }))
        : null,
      players: this.players.map((p, index) => ({
        id: p.id,
        username: p.username,
        handCount: p.hand.length,
        capturedCount: p.captured.length,
        score: p.score,
        isHost: p.id === this.hostId,
        isDealer: index === this.dealerIndex,
        isTireur: index === this.tireurIndex,
        isTurn: index === this.turnIndex,
        team: p.team,
      })),
    };
  }

  _assignTeams() {
    if (!this.isTeamMode()) {
      this.players.forEach((player) => {
        player.team = null;
      });
      return;
    }
    this.players.forEach((player, index) => {
      player.team = index % 2 === 0 ? 'A' : 'B';
    });
  }

  _buildTeamLayout() {
    const layout = [
      { key: 'A', name: TEAM_NAMES.A, members: [] },
      { key: 'B', name: TEAM_NAMES.B, members: [] },
    ];
    const map = {
      A: layout[0],
      B: layout[1],
    };
    this.players.forEach((player) => {
      if (player.team && map[player.team]) {
        map[player.team].members.push({
          id: player.id,
          username: player.username,
          isHost: player.id === this.hostId,
        });
      }
    });
    return layout;
  }
}

function awardCategory(stats, key, label) {
  const maxValue = Math.max(...stats.map((s) => s[key]));
  if (maxValue === 0) {
    return;
  }
  const winners = stats.filter((s) => s[key] === maxValue);
  if (winners.length === 1) {
    winners[0].roundPoints += 1;
    winners[0].lastAward = label;
  }
}

function awardSevenOfDiamonds(stats) {
  stats.forEach((stat) => {
    if (stat.hasSevenOfDiamonds) {
      stat.roundPoints += 1;
    }
  });
}

function findCombination(cards, target) {
  let bestCombo = [];
  function search(startIndex, sum, picks) {
    if (sum === target && picks.length > 1) {
      const combo = picks.map((index) => cards[index]);
      if (combo.length > bestCombo.length) {
        bestCombo = combo;
      }
      return;
    }
    if (sum >= target) {
      return;
    }
    for (let i = startIndex; i < cards.length; i += 1) {
      search(i + 1, sum + cards[i].value, picks.concat(i));
    }
  }
  search(0, 0, []);
  return bestCombo;
}

function resolveIndex(list, id, fallback) {
  if (!list.length) {
    return 0;
  }
  if (!id) {
    return fallback % list.length;
  }
  const idx = list.findIndex((item) => item.id === id);
  if (idx === -1) {
    return fallback % list.length;
  }
  return idx;
}

function normalizeTargetScore(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return TARGET_SCORE;
  }
  const clamped = Math.max(5, Math.min(Math.round(parsed), 51));
  return clamped;
}

module.exports = GameRoom;
