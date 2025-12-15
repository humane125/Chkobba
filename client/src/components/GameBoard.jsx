import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import ConfirmModal from './ConfirmModal';
import {
  POINT_ICON,
  computeCaptureTargets,
  getCardAsset,
  HIDDEN_CARD_ASSET,
} from '../utils/cardUtils';

function GameBoard({
  session,
  gameState,
  onPlayCard,
  onContinueRound,
  fullScreen,
  onLeaveRoom,
  onStopGame,
}) {
  const [pendingDiscard, setPendingDiscard] = useState(null);
  const [previewInfo, setPreviewInfo] = useState({ cardId: null, targets: [] });
  const [chkobbaFlash, setChkobbaFlash] = useState(null);
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [handDealing, setHandDealing] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showCheatHands, setShowCheatHands] = useState(false);

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

  const hasRoom = !!session.roomCode;
  const status = gameState?.status ?? 'waiting';
  const round = gameState?.round ?? 0;
  const targetScore = gameState?.targetScore ?? 11;
  const players = gameState?.players ?? [];
  const tableCards = gameState?.tableCards ?? [];
  const yourHand = gameState?.yourHand ?? [];
  const yourCaptured = gameState?.yourCaptured ?? 0;
  const yourCapturedCards = gameState?.yourCapturedCards ?? [];
  const chkobba = gameState?.chkobba ?? 0;
  const turnPlayerId = gameState?.turnPlayerId ?? null;
  const lastActionLog = gameState?.lastActionLog ?? 'Waiting for players';
  const lastRoundSummary = gameState?.lastRoundSummary ?? null;
  const selfId = gameState?.selfId || session.playerId || '';
  const mode = gameState?.mode ?? '1v1';
  const teams = gameState?.teams ?? [];
  const teamScores = gameState?.teamScores ?? {};
  const readyPlayerIds = gameState?.readyPlayerIds ?? [];
  const awaitingReady = gameState?.awaitingReady ?? false;
  const winnerId = gameState?.winnerId ?? null;
  const dealerId = gameState?.dealerId ?? null;
  const tireurId = gameState?.tireurId ?? null;
  const cheatHands = gameState?.cheatHands;
  const canCheat = Array.isArray(cheatHands);

  const normalizedStatus = typeof status === 'string' ? status.trim() : status;
  const showLiveTable =
    hasRoom &&
    (normalizedStatus === 'running' ||
      normalizedStatus === 'between_rounds' ||
      normalizedStatus === 'finished');

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

  const seatLayout = useMemo(
    () => buildSeatLayout(players, selfId, mode),
    [players, selfId, mode],
  );

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

  const statusLabel =
    status === 'running'
      ? 'Playing'
      : status === 'between_rounds'
        ? 'Between rounds'
        : status === 'finished'
          ? 'Finished'
          : 'Waiting';

  const overlayMode = fullScreen && showLiveTable;

  if (overlayMode) {
    return (
      <div className="table-overlay">
        <div className="overlay-felt">
          <div className="overlay-actions-bottom">
            <button type="button" className="danger ghost" onClick={onLeaveRoom}>
              Leave Room
            </button>
            {canCheat && (
              <button
                type="button"
                className="ghost cheat-toggle"
                onClick={() => setShowCheatHands((prev) => !prev)}
              >
                {showCheatHands ? 'Hide hands' : 'Show hands'}
              </button>
            )}
            {session.isHost && (
              <button type="button" className="ghost" onClick={() => setShowStopConfirm(true)}>
                Return to Lobby
              </button>
            )}
          </div>
          <div className="overlay-info-bar">
            <div className="overlay-log">{lastActionLog}</div>
            <div className="overlay-stats-bar">
              <span>Captured: {yourCaptured}</span>
              <span>Chkobba: {chkobba}</span>
              <span>Status: {statusLabel}</span>
            </div>
          </div>

          <div className="overlay-grid">
            {seatLayout.north && (
              <SeatBadge
                position="north"
                player={seatLayout.north}
                selfId={selfId}
                isTurn={seatLayout.north?.id === turnPlayerId}
                isDealer={seatLayout.north?.id === dealerId}
                isTireur={seatLayout.north?.id === tireurId}
                showCheatHands={showCheatHands}
                cheatHands={cheatHands}
              />
            )}
            {seatLayout.west && (
              <SeatBadge
                position="west"
                player={seatLayout.west}
                selfId={selfId}
                isTurn={seatLayout.west?.id === turnPlayerId}
                isDealer={seatLayout.west?.id === dealerId}
                isTireur={seatLayout.west?.id === tireurId}
                showCheatHands={showCheatHands}
                cheatHands={cheatHands}
              />
            )}
            {seatLayout.east && (
              <SeatBadge
                position="east"
                player={seatLayout.east}
                selfId={selfId}
                isTurn={seatLayout.east?.id === turnPlayerId}
                isDealer={seatLayout.east?.id === dealerId}
                isTireur={seatLayout.east?.id === tireurId}
                showCheatHands={showCheatHands}
                cheatHands={cheatHands}
              />
            )}

            <div className="overlay-center">
              <div className="overlay-center-pile">
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
              {chkobbaFlash && (
                <div className="overlay-flash">
                  <img src={POINT_ICON} alt="Chkobba bonus" />
                  <span>Chkobba!</span>
                </div>
              )}
            </div>

            <div className="overlay-handbar">
              <div className="overlay-seat-label">
                You {selfTeam ? `• Team ${selfTeam}` : ''}
              </div>
              <div className="overlay-hand-row flat-hand">
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
            </div>
          </div>

        </div>

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
          open={showStopConfirm}
          title="Return to lobby?"
          description="This will stop the current game and send everyone back to the lobby. Continue?"
          confirmLabel="Stop game"
          cancelLabel="Cancel"
          onConfirm={() => {
            setShowStopConfirm(false);
            onStopGame();
          }}
          onCancel={() => setShowStopConfirm(false)}
        />

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

  if (!hasRoom) {
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

  return (
    <div
      className={`panel game-panel ${showLiveTable ? 'live-table' : 'pre-table'} ${
        fullScreen ? 'full-screen' : ''
      }`}
    >
      <div className="panel-heading">
        <div>
          <h2>Table</h2>
          {showLiveTable ? (
            <p className="muted small">Green felt view with seats around the mat.</p>
          ) : (
            <p className="muted small">
              Waiting for the host to start. The green table will appear once the match begins.
            </p>
          )}
        </div>
        <div className="round-pill">
          Round {round ?? 0} • Target {targetScore ?? 11} pts
        </div>
      </div>

      {mode === '2v2' && (
        <div className="team-board">
          {teams.map((team) => (
            <div className="team-card" key={`score-${team.key}`}>
              <div className="team-card-heading">
                <strong>{team.name}</strong>
                <span>{teamScores?.[team.key] ?? 0} pts</span>
              </div>
              <div className="team-members">
                {team.members.length === 0 ? (
                  <span className="muted">Waiting for players...</span>
                ) : (
                  team.members.map((member) => (
                    <span key={`tm-${member.id}`}>
                      {member.username}
                      {member.id === selfId ? ' (you)' : ''}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!showLiveTable ? (
        <div className="pre-table-body">
          <p className="muted">
            Stay in the room; when the host starts the game you will see your cards at the bottom,
            opponents&apos; hands will be face-down, and teammates (in 2v2) will sit across from you.
          </p>
          <div className="ready-list">
            {players.map((player) => (
              <span key={`waiting-${player.id}`} className="ready-pill waiting">
                {player.username} • waiting
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className={`felt-shell status-${status}`}>
        <div className="table-top-bar">
          <div className="pill-row">
            <span className="table-pill">{statusLabel}</span>
            <span className="table-pill">Round {round ?? 0}</span>
            <span className="table-pill">Target {targetScore ?? 11} pts</span>
            {mode === '2v2' && (
              <span className="table-pill">
                Team A {teamScores?.A ?? 0} • Team B {teamScores?.B ?? 0}
              </span>
            )}
          </div>
          <div className="log-chip">{lastActionLog}</div>
        </div>

        <div className="table-mat">
          <SeatView
            position="north"
            seatLabel="North"
            player={seatLayout.north}
            isSelf={seatLayout.north?.id === selfId}
            isTeammate={
              !!(seatLayout.north && seatLayout.north.id !== selfId && selfTeam && seatLayout.north.team === selfTeam)
            }
            isTurn={seatLayout.north?.id === turnPlayerId}
            isDealer={seatLayout.north?.id === dealerId}
            isTireur={seatLayout.north?.id === tireurId}
            isHost={seatLayout.north?.isHost}
          />

          <SeatView
            position="west"
            seatLabel="West"
            player={seatLayout.west}
            isSelf={seatLayout.west?.id === selfId}
            isTeammate={
              !!(seatLayout.west && seatLayout.west.id !== selfId && selfTeam && seatLayout.west.team === selfTeam)
            }
            isTurn={seatLayout.west?.id === turnPlayerId}
            isDealer={seatLayout.west?.id === dealerId}
            isTireur={seatLayout.west?.id === tireurId}
            isHost={seatLayout.west?.isHost}
          />

          <div className="table-center">
            <div className="table-preview">
              <div className="preview-text">{previewMessage}</div>
              {chkobbaFlash && (
                <div className="chkobba-flash">
                  <img src={POINT_ICON} alt="Chkobba bonus" />
                  <span>Chkobba!</span>
                </div>
              )}
            </div>
            <div className="card-row table-row">
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

          <SeatView
            position="east"
            seatLabel="East"
            player={seatLayout.east}
            isSelf={seatLayout.east?.id === selfId}
            isTeammate={
              !!(seatLayout.east && seatLayout.east.id !== selfId && selfTeam && seatLayout.east.team === selfTeam)
            }
            isTurn={seatLayout.east?.id === turnPlayerId}
            isDealer={seatLayout.east?.id === dealerId}
            isTireur={seatLayout.east?.id === tireurId}
            isHost={seatLayout.east?.isHost}
          />

          <SeatView
            position="south"
            seatLabel="You"
            player={seatLayout.south}
            isSelf
            isTeammate={false}
            isTurn={seatLayout.south?.id === turnPlayerId}
            isDealer={seatLayout.south?.id === dealerId}
            isTireur={seatLayout.south?.id === tireurId}
            isHost={seatLayout.south?.isHost}
            hand={yourHand}
            captured={yourCaptured}
            chkobba={chkobba}
            onCardClick={handleCardClick}
            onHover={handleHover}
            onLeave={handleLeave}
            isYourTurn={isYourTurn}
            handDealing={handDealing}
          />
        </div>
      </div>
      )}

      <div className="player-stats bar">
        <span>Captured: {yourCaptured}</span>
        <span>Chkobba: {chkobba}</span>
        <span>Status: {statusLabel}</span>
      </div>

      <CapturedPile cards={yourCapturedCards} />

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

function SeatView({
  position,
  seatLabel,
  player,
  isSelf,
  isTeammate,
  isTurn,
  isDealer,
  isTireur,
  isHost,
  hand = [],
  captured,
  chkobba,
  onCardClick,
  onHover,
  onLeave,
  isYourTurn,
  handDealing,
}) {
  const handCount = isSelf ? hand.length : player?.handCount ?? 0;
  const capturedCount = isSelf ? captured : player?.capturedCount ?? 0;
  const score = player?.score ?? 0;
  const name = player?.username ?? 'Open seat';
  const tags = [];
  if (isHost) tags.push('Host');
  if (isDealer) tags.push('Dealer');
  if (isTireur) tags.push('Lead');
  if (isTurn) tags.push('Turn');
  if (isTeammate) tags.push('Teammate');
  if (player?.team) tags.push(player.team === 'A' ? 'Team A' : 'Team B');

  return (
    <div
      className={[
        'seat-card',
        `seat-${position}`,
        isTurn ? 'active' : '',
        isSelf ? 'self-seat' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="seat-header">
        <div>
          <div className="seat-name">
            {name} {isSelf && <span className="you-pill">you</span>}
          </div>
          <div className="seat-label">{seatLabel}</div>
        </div>
        <div className="seat-score">{player ? `${score} pts` : ''}</div>
      </div>
      <div className="seat-tags">
        {tags.map((tag) => (
          <span key={`${position}-${tag}`}>{tag}</span>
        ))}
      </div>
      <div className="seat-hand">
        {isSelf ? (
          <div className={`card-row hand-row ${handDealing ? 'dealing' : ''}`}>
            {hand.length === 0 && <p className="muted">Waiting for the next deal.</p>}
            {hand.map((card, index) => (
              <button
                type="button"
                key={card.id}
                className={`card-button ${isYourTurn ? '' : 'disabled'}`}
                onClick={() => onCardClick(card)}
                onMouseEnter={() => onHover(card)}
                onFocus={() => onHover(card)}
                onMouseLeave={onLeave}
                onBlur={onLeave}
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
        ) : (
          <HiddenHand count={handCount} />
        )}
      </div>
      <div className="seat-footer">
        <span>{capturedCount ?? 0} captured</span>
        {typeof chkobba === 'number' && isSelf && <span>Chkobba: {chkobba}</span>}
        {!isSelf && player && <span>Cards: {handCount}</span>}
      </div>
    </div>
  );
}

function HiddenHand({ count }) {
  if (!count) {
    return <p className="muted small">No cards</p>;
  }
  return (
    <div className="card-row hidden-row">
      {Array.from({ length: count }).map((_, index) => (
        <CardTile
          key={`hidden-${index}`}
          card={{ id: `hidden-${index}`, label: 'Hidden card' }}
          hidden
          compact
        />
      ))}
    </div>
  );
}

function SeatBadge({
  position,
  player,
  selfId,
  isTurn,
  isDealer,
  isTireur,
  showCheatHands,
  cheatHands,
}) {
  const name = player ? player.username : 'Empty seat';
  const isSelf = player && player.id === selfId;
  const tags = [];
  if (isSelf) tags.push('You');
  if (player?.isHost) tags.push('Host');
  if (isTurn) tags.push('Turn');
  if (isDealer) tags.push('Dealer');
  if (isTireur) tags.push('Lead');
  if (player?.team) tags.push(`Team ${player.team}`);

  return (
    <div className={`overlay-seat ${position}`}>
      <div className="overlay-badge">
        <span className="name">
          {name} {isSelf && <span className="you-pill">you</span>}
        </span>
        <div className="tags">
          {tags.map((tag) => (
            <span key={`${position}-${tag}`}>{tag}</span>
          ))}
        </div>
        <div className="hidden-hand">
          {showCheatHands && Array.isArray(cheatHands) && player
            ? renderCheatHand(player.id, cheatHands)
            : <HiddenHand count={player?.handCount ?? 0} />}
        </div>
      </div>
    </div>
  );
}

function renderCheatHand(playerId, cheatHands) {
  const entry = cheatHands.find((item) => item.playerId === playerId);
  if (!entry) {
    return <HiddenHand count={0} />;
  }
  return (
    <div className="card-row cheat-hand-row">
      {entry.hand.length === 0 ? (
        <span className="muted small">No cards</span>
      ) : (
        entry.hand.map((card) => <CardTile key={`cheat-${playerId}-${card.id}`} card={card} compact />)
      )}
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
    if (maxValue > 0 && entry[key] === maxValue && winners.length === 1) {
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

function buildSeatLayout(players = [], selfId, mode) {
  const selfPlayer = players.find((player) => player.id === selfId) || null;
  const others = players.filter((player) => player.id !== selfId);

  if (mode === '2v2' && selfPlayer?.team) {
    const teammate = others.find((player) => player.team === selfPlayer.team) || null;
    const opponents = others.filter((player) => player.team !== selfPlayer.team);
    const [oppA, oppB] = opponents;

    return {
      south: selfPlayer,
      north: teammate || oppA || null,
      west: oppA || null,
      east: oppB || null,
    };
  }

  const [oppA, oppB] = others;
  return {
    south: selfPlayer,
    north: oppA || null,
    west: oppB || null,
    east: null,
  };
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
    dealerId: PropTypes.string,
    tireurId: PropTypes.string,
    cheatHands: PropTypes.arrayOf(
      PropTypes.shape({
        playerId: PropTypes.string,
        username: PropTypes.string,
        hand: PropTypes.arrayOf(PropTypes.object),
      }),
    ),
  }),
  onPlayCard: PropTypes.func.isRequired,
  onContinueRound: PropTypes.func.isRequired,
  fullScreen: PropTypes.bool,
  onLeaveRoom: PropTypes.func,
  onStopGame: PropTypes.func,
};

SeatView.propTypes = {
  position: PropTypes.string.isRequired,
  seatLabel: PropTypes.string.isRequired,
  player: PropTypes.shape({
    id: PropTypes.string,
    username: PropTypes.string,
    handCount: PropTypes.number,
    capturedCount: PropTypes.number,
    score: PropTypes.number,
    team: PropTypes.string,
    isHost: PropTypes.bool,
  }),
  isSelf: PropTypes.bool,
  isTeammate: PropTypes.bool,
  isTurn: PropTypes.bool,
  isDealer: PropTypes.bool,
  isTireur: PropTypes.bool,
  isHost: PropTypes.bool,
  hand: PropTypes.arrayOf(PropTypes.object),
  captured: PropTypes.number,
  chkobba: PropTypes.number,
  onCardClick: PropTypes.func,
  onHover: PropTypes.func,
  onLeave: PropTypes.func,
  isYourTurn: PropTypes.bool,
  handDealing: PropTypes.bool,
};

HiddenHand.propTypes = {
  count: PropTypes.number,
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

SeatBadge.propTypes = {
  position: PropTypes.string.isRequired,
  player: PropTypes.shape({
    id: PropTypes.string,
    username: PropTypes.string,
    handCount: PropTypes.number,
    team: PropTypes.string,
  }),
  selfId: PropTypes.string,
  isTurn: PropTypes.bool,
  isDealer: PropTypes.bool,
  isTireur: PropTypes.bool,
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

CapturedPile.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.object).isRequired,
};

GameBoard.defaultProps = {
  gameState: null,
  fullScreen: false,
  onLeaveRoom: () => {},
  onStopGame: () => {},
};

SeatView.defaultProps = {
  player: null,
  isSelf: false,
  isTeammate: false,
  isTurn: false,
  isDealer: false,
  isTireur: false,
  isHost: false,
  hand: [],
  captured: 0,
  chkobba: undefined,
  onCardClick: () => {},
  onHover: () => {},
  onLeave: () => {},
  isYourTurn: false,
  handDealing: false,
};

HiddenHand.defaultProps = {
  count: 0,
};

CardTile.defaultProps = {
  highlighted: false,
  compact: false,
  hidden: false,
  dealActive: false,
  dealIndex: 0,
};

SeatBadge.defaultProps = {
  player: null,
  selfId: '',
  isTurn: false,
  isDealer: false,
  isTireur: false,
  showCheatHands: false,
  cheatHands: [],
};

SeatBadge.propTypes = {
  position: PropTypes.string.isRequired,
  player: PropTypes.shape({
    id: PropTypes.string,
    username: PropTypes.string,
    handCount: PropTypes.number,
    team: PropTypes.string,
    isHost: PropTypes.bool,
  }),
  selfId: PropTypes.string,
  isTurn: PropTypes.bool,
  isDealer: PropTypes.bool,
  isTireur: PropTypes.bool,
  showCheatHands: PropTypes.bool,
  cheatHands: PropTypes.arrayOf(
    PropTypes.shape({
      playerId: PropTypes.string,
      hand: PropTypes.arrayOf(PropTypes.object),
      username: PropTypes.string,
    }),
  ),
};

RoundSummaryModal.defaultProps = {
  breakdown: null,
  allBreakdown: [],
};

export default GameBoard;
