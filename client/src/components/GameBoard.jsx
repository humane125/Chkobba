import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import ConfirmModal from './ConfirmModal';
import {
  POINT_ICON,
  computeCaptureTargets,
  getCardAsset,
  HIDDEN_CARD_ASSET,
} from '../utils/cardUtils';

function GameBoard({ session, gameState, onPlayCard, onContinueRound }) {
  const [pendingDiscard, setPendingDiscard] = useState(null);
  const [previewInfo, setPreviewInfo] = useState({ cardId: null, targets: [] });
  const [chkobbaFlash, setChkobbaFlash] = useState(null);
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [handDealing, setHandDealing] = useState(false);
  const previewIds = useMemo(() => {
    const ids = new Set();
    previewInfo.targets.forEach((card) => ids.add(card.id));
    return ids;
  }, [previewInfo]);

  useEffect(() => {
    if (!gameState?.lastChkobbaEvent || !gameState?.selfId) {
      setChkobbaFlash(null);
      return;
    }
    const event = gameState.lastChkobbaEvent;
    if (event.playerId !== gameState.selfId) {
      setChkobbaFlash(null);
      return;
    }
    setChkobbaFlash(event);
    const timeout = setTimeout(() => setChkobbaFlash(null), 2500);
    return () => clearTimeout(timeout);
  }, [gameState?.lastChkobbaEvent, gameState?.selfId]);

  useEffect(() => {
    if (
      gameState?.status === 'finished' &&
      gameState?.winnerId &&
      gameState.winnerId === gameState.selfId
    ) {
      setWinnerModalOpen(true);
    } else {
      setWinnerModalOpen(false);
    }
  }, [gameState?.status, gameState?.winnerId, gameState?.selfId]);

  useEffect(() => {
    if (!gameState?.handAnimationToken) {
      return;
    }
    setHandDealing(true);
    const timeout = setTimeout(() => setHandDealing(false), 600);
    return () => clearTimeout(timeout);
  }, [gameState?.handAnimationToken]);

  if (!session.roomCode) {
    return (
      <div className="panel game-panel placeholder">
        <h2>Game</h2>
        <p>Join or create a room to start playing.</p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="panel game-panel placeholder">
        <h2>Game</h2>
        <p>Waiting for the server to sync the game state...</p>
      </div>
    );
  }

  const {
    status,
    round,
    targetScore,
    players = [],
    tableCards = [],
    yourHand = [],
    yourCaptured = 0,
    yourCapturedCards = [],
    chkobba = 0,
    turnPlayerId,
    lastActionLog,
    lastRoundSummary,
    selfId,
    mode,
    teams = [],
    teamScores,
    readyPlayerIds = [],
    awaitingReady = false,
    winnerId,
  } = gameState;

  const isYourTurn = status === 'running' && turnPlayerId === selfId;
  const selfPlayer = players.find((player) => player.id === selfId);
  const selfTeam = selfPlayer?.team;
  const personalBreakdown =
    lastRoundSummary &&
    (mode === '2v2'
      ? lastRoundSummary.breakdown?.find((entry) => entry.teamKey === selfTeam)
      : lastRoundSummary.breakdown?.find(
          (entry) => entry.playerId === selfPlayer?.id,
        ));
  const hasConfirmedReady = readyPlayerIds.includes(selfId);

  const handleHover = (card) => {
    const targets = computeCaptureTargets(card, tableCards);
    setPreviewInfo({ cardId: card.id, targets });
  };

  const handleLeave = () => {
    setPreviewInfo({ cardId: null, targets: [] });
  };

  const handleCardClick = (card) => {
    if (!isYourTurn) {
      return;
    }
    const targets = computeCaptureTargets(card, tableCards);
    if (targets.length === 0) {
      setPendingDiscard(card);
      return;
    }
    onPlayCard(card.id);
  };

  const confirmDiscard = () => {
    if (!pendingDiscard) {
      return;
    }
    onPlayCard(pendingDiscard.id);
    setPendingDiscard(null);
  };

  const previewMessage = previewInfo.cardId
    ? previewInfo.targets.length
      ? `Capturing ${previewInfo.targets.length} card${
          previewInfo.targets.length > 1 ? 's' : ''
        }`
      : 'No capture available'
    : 'Hover a card in your hand to preview the capture.';

  return (
    <div className="panel game-panel">
      <div className="panel-heading">
        <h2>Game</h2>
        <div className="round-pill">
          Round {round ?? 0} • Target {targetScore ?? 11} pts
        </div>
      </div>

      {mode === '2v2' && (
        <TeamBoard teams={teams} teamScores={teamScores} />
      )}

      <div className="players-grid">
        {players.map((player) => (
          <div
            key={player.id}
            className={`player-card ${
              player.id === turnPlayerId ? 'active' : ''
            } ${player.id === selfId ? 'self' : ''}`}
          >
            <div className="player-name">
              {player.username}{' '}
              {player.id === selfId && <span className="you-pill">you</span>}
            </div>
            <div className="player-meta">
              <span>{player.score} pts</span>
              <span>{player.capturedCount} cards</span>
            </div>
            <div className="player-tags">
              {player.team && (
                <span>{player.team === 'A' ? 'Team A' : 'Team B'}</span>
              )}
              {player.isHost && <span>Host</span>}
              {player.id === turnPlayerId && <span>Turn</span>}
            </div>
            <div className="player-chkobba-count">Chkobba: {player.chkobbaCount}</div>
          </div>
        ))}
      </div>

      <div className="table-area">
        <div className="table-heading">
          <h3>Table</h3>
          <span className="preview-text">{previewMessage}</span>
        </div>
        <div className="card-row">
          {tableCards.length === 0 && (
            <p className="muted">No cards on the table.</p>
          )}
          {tableCards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              highlighted={previewIds.has(card.id)}
            />
          ))}
        </div>
      </div>

      <div className="hand-section">
        <div className="hand-area">
          <div className="hand-heading">
            <h3>Your Hand</h3>
            <span className={`turn-pill ${isYourTurn ? 'active' : ''}`}>
              {isYourTurn ? 'Your turn' : 'Waiting...'}
            </span>
          </div>
          <div className={`card-row hand-row ${handDealing ? 'dealing' : ''}`}>
            {yourHand.length === 0 && (
              <p className="muted">Waiting for the next deal.</p>
            )}
            {yourHand.map((card, index) => (
              <button
                type="button"
                key={card.id}
                className={`card-button ${isYourTurn ? '' : 'disabled'}`}
                onClick={() => handleCardClick(card)}
                onMouseEnter={() => handleHover(card)}
                onFocus={() => handleHover(card)}
                onMouseLeave={handleLeave}
                onBlur={handleLeave}
                aria-disabled={!isYourTurn}
                tabIndex={isYourTurn ? 0 : -1}
                title={card.name}
              >
                <CardTile
                  card={card}
                  compact
                  dealActive={handDealing}
                  dealIndex={index}
                />
              </button>
            ))}
          </div>
          <div className="player-stats">
            <span>Captured: {yourCaptured}</span>
            <span>Chkobba: {chkobba}</span>
            <span>Status: {status}</span>
          </div>
        </div>
        <CapturedPile cards={yourCapturedCards} />
      </div>

      <div className="log-area">
        <strong>Latest:</strong> {lastActionLog}
      </div>

      {chkobbaFlash && (
        <div className="chkobba-flash">
          <img src={POINT_ICON} alt="Chkobba bonus" />
          <span>Chkobba!</span>
        </div>
      )}

      {lastRoundSummary && lastRoundSummary.breakdown?.length > 0 && (
        <div className="summary-area">
          <h3>
            Round {lastRoundSummary.round} Summary{' '}
            {mode === '2v2' && <span className="mode-pill">2v2 teams</span>}
          </h3>
          <div className="summary-table">
            <div className="summary-row header">
              <span>{mode === '2v2' ? 'Team' : 'Player'}</span>
              <span>Cards</span>
              <span>Diamonds</span>
              <span>Sevens</span>
              <span>Chkobba</span>
              <span>7♦</span>
              <span>Round</span>
              <span>Total</span>
            </div>
            {lastRoundSummary.breakdown.map((entry) => (
              <div className="summary-row" key={entry.username}>
                <span>{entry.username}</span>
                <span>{entry.cards}</span>
                <span>{entry.diamonds}</span>
                <span>{entry.sevens}</span>
                <span>{entry.chkobba}</span>
                <span>{entry.sevenOfDiamonds ? 'Yes' : '—'}</span>
                <span>{entry.pointsEarned}</span>
                <span>{entry.totalScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(pendingDiscard)}
        title="Discard this card?"
        description={
          pendingDiscard
            ? `${pendingDiscard.label} cannot capture anything on the table. Throw it away anyway?`
            : ''
        }
        confirmLabel="Throw card"
        cancelLabel="Cancel"
        onConfirm={confirmDiscard}
        onCancel={() => setPendingDiscard(null)}
      />
      {awaitingReady && (
        <RoundSummaryModal
          breakdown={personalBreakdown}
          capturedCards={yourCapturedCards}
          readyPlayerIds={readyPlayerIds}
          players={players}
          hasConfirmed={hasConfirmedReady}
          allBreakdown={lastRoundSummary?.breakdown ?? []}
          onContinue={onContinueRound}
        />
      )}
      <ConfirmModal
        open={winnerModalOpen}
        title="You won the match!"
        description="Great job hitting the target score."
        confirmLabel="Nice!"
        cancelLabel="Close"
        onConfirm={() => setWinnerModalOpen(false)}
        onCancel={() => setWinnerModalOpen(false)}
      />
    </div>
  );
}

function CardTile({ card, highlighted, compact, hidden, dealActive, dealIndex }) {
  if (!card) {
    return null;
  }
  const asset = hidden ? HIDDEN_CARD_ASSET : getCardAsset(card);
  const classes = ['card-frame'];
  if (highlighted) {
    classes.push('highlighted');
  }
  if (compact) {
    classes.push('compact');
  }
  if (dealActive) {
    classes.push('deal-animate');
  }
  const style = dealActive ? { animationDelay: `${(dealIndex || 0) * 80}ms` } : undefined;
  return (
    <div className={classes.join(' ')} style={style}>
      <img src={asset} alt={hidden ? 'Hidden card' : card.label} />
    </div>
  );
}

function RoundSummaryModal({
  breakdown,
  capturedCards,
  readyPlayerIds,
  players,
  hasConfirmed,
  onContinue,
  allBreakdown,
}) {
  const awardTags = deriveAwardTags(breakdown, allBreakdown);
  return (
    <div className="modal-backdrop">
      <div className="round-modal">
        <h3>Round Results</h3>
        {breakdown ? (
          <>
            <div className="round-stats-grid">
              <div className="stat-card">
                <strong>Cards</strong>
                <span>{breakdown.cards}</span>
              </div>
              <div className="stat-card">
                <strong>Diamonds</strong>
                <span>{breakdown.diamonds}</span>
              </div>
              <div className="stat-card">
                <strong>Sevens</strong>
                <span>{breakdown.sevens}</span>
              </div>
              <div className="stat-card">
                <strong>Chkobba Bonus</strong>
                <span>{breakdown.chkobba}</span>
              </div>
              <div className="stat-card">
                <strong>7♦</strong>
                <span>{breakdown.sevenOfDiamonds ? 'Yes' : 'No'}</span>
              </div>
              <div className="stat-card">
                <strong>Points Earned</strong>
                <span>{breakdown.pointsEarned}</span>
              </div>
            </div>
            {awardTags.length > 0 && (
              <div className="award-tags">
                {awardTags.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            )}
            <div className="captured-panel condensed">
              <div className="panel-heading">
                <h3>Captured Cards</h3>
                <span>{capturedCards.length} total</span>
              </div>
              <div className="captured-strip">
                {capturedCards.length === 0 ? (
                  <p className="muted">No captured cards.</p>
                ) : (
                  capturedCards.map((card) => (
                    <CardTile key={`cap-${card.id}`} card={card} compact />
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="muted">Waiting for the round summary...</p>
        )}
        <div className="ready-list">
          {players.map((player) => {
            const ready = readyPlayerIds.includes(player.id);
            return (
              <span
                key={`ready-${player.id}`}
                className={`ready-pill ${ready ? 'ready' : 'waiting'}`}
              >
                {player.username} • {ready ? 'Ready' : 'Thinking...'}
              </span>
            );
          })}
        </div>
        <button
          type="button"
          className="primary"
          onClick={onContinue}
          disabled={hasConfirmed}
        >
          {hasConfirmed ? 'Waiting for others...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

function TeamBoard({ teams = [], teamScores = {} }) {
  return (
    <div className="team-board">
      {teams.map((team) => (
        <div className="team-card" key={team.key}>
          <div className="team-card-heading">
            <strong>{team.name}</strong>
            <span>{teamScores?.[team.key] ?? 0} pts</span>
          </div>
          <div className="team-members">
            {team.members.length === 0 ? (
              <span className="muted">Waiting for players...</span>
            ) : (
              team.members.map((member) => (
                <span key={member.id}>{member.username}</span>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CapturedPile({ cards }) {
  return (
    <div className="captured-panel live">
      <div className="panel-heading">
        <h3>Captured Pile</h3>
        <span>{cards.length} cards</span>
      </div>
      <p className="muted small">Cards stay hidden until the round ends.</p>
      <div className="captured-strip">
        {cards.length === 0 ? (
          <p className="muted">No captures yet.</p>
        ) : (
          cards.map((card) => (
            <CardTile key={`live-cap-${card.id}`} card={card} compact hidden />
          ))
        )}
      </div>
    </div>
  );
}

const AWARD_FIELDS = [
  { key: 'cards', label: 'Most cards' },
  { key: 'diamonds', label: 'Most diamonds' },
  { key: 'sevens', label: 'Most sevens' },
];

function deriveAwardTags(entry, breakdownList = []) {
  if (!entry || !Array.isArray(breakdownList) || breakdownList.length === 0) {
    return [];
  }
  const tags = [];
  AWARD_FIELDS.forEach(({ key, label }) => {
    const maxValue = Math.max(...breakdownList.map((item) => item[key] ?? 0));
    const winners = breakdownList.filter((item) => (item[key] ?? 0) === maxValue);
    if (
      maxValue > 0 &&
      entry[key] === maxValue &&
      winners.length === 1
    ) {
      tags.push(label);
    }
  });
  if (entry.sevenOfDiamonds) {
    tags.push('7♦ bonus');
  }
  if (entry.chkobba) {
    tags.push(`Chkobba x${entry.chkobba}`);
  }
  return tags;
}

GameBoard.propTypes = {
  session: PropTypes.shape({
    roomCode: PropTypes.string,
  }).isRequired,
  gameState: PropTypes.shape({
    status: PropTypes.string,
    round: PropTypes.number,
    targetScore: PropTypes.number,
    players: PropTypes.arrayOf(PropTypes.object),
    tableCards: PropTypes.arrayOf(PropTypes.object),
    yourHand: PropTypes.arrayOf(PropTypes.object),
    yourCaptured: PropTypes.number,
    yourCapturedCards: PropTypes.arrayOf(PropTypes.object),
    chkobba: PropTypes.number,
    turnPlayerId: PropTypes.string,
    lastActionLog: PropTypes.string,
    lastRoundSummary: PropTypes.object,
    selfId: PropTypes.string,
    mode: PropTypes.string,
    teams: PropTypes.arrayOf(PropTypes.object),
    teamScores: PropTypes.object,
    readyPlayerIds: PropTypes.arrayOf(PropTypes.string),
    awaitingReady: PropTypes.bool,
    handAnimationToken: PropTypes.number,
    winnerId: PropTypes.string,
  }),
  onPlayCard: PropTypes.func.isRequired,
  onContinueRound: PropTypes.func.isRequired,
};

CardTile.propTypes = {
  card: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string,
  }).isRequired,
  highlighted: PropTypes.bool,
  compact: PropTypes.bool,
  hidden: PropTypes.bool,
  dealActive: PropTypes.bool,
  dealIndex: PropTypes.number,
};

RoundSummaryModal.propTypes = {
  breakdown: PropTypes.shape({
    cards: PropTypes.number,
    diamonds: PropTypes.number,
    sevens: PropTypes.number,
    chkobba: PropTypes.number,
    sevenOfDiamonds: PropTypes.bool,
    pointsEarned: PropTypes.number,
  }),
  capturedCards: PropTypes.arrayOf(PropTypes.object).isRequired,
  readyPlayerIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  players: PropTypes.arrayOf(PropTypes.object).isRequired,
  hasConfirmed: PropTypes.bool.isRequired,
  onContinue: PropTypes.func.isRequired,
  allBreakdown: PropTypes.arrayOf(PropTypes.object),
};

TeamBoard.propTypes = {
  teams: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      name: PropTypes.string,
      members: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          username: PropTypes.string,
        }),
      ),
    }),
  ),
  teamScores: PropTypes.object,
};

CapturedPile.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.object).isRequired,
};

GameBoard.defaultProps = {
  gameState: null,
};

CardTile.defaultProps = {
  highlighted: false,
  compact: false,
  hidden: false,
  dealActive: false,
  dealIndex: 0,
};

RoundSummaryModal.defaultProps = {
  breakdown: null,
  allBreakdown: [],
};

TeamBoard.defaultProps = {
  teams: [],
  teamScores: {},
};

export default GameBoard;
