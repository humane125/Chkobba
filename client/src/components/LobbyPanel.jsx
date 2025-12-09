import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

function LobbyPanel({
  username,
  onUsernameChange,
  roomCodeInput,
  onRoomCodeChange,
  onCreateRoom,
  onJoinRoom,
  session,
  lobbyState,
  onStartGame,
  onLeaveRoom,
  roomModeChoice,
  roomTargetChoice,
  onRoomModeChange,
  onRoomTargetChange,
  onUpdateSettings,
  onKickPlayer,
  onPromotePlayer,
  error,
}) {
  const [targetScoreDraft, setTargetScoreDraft] = useState(
    lobbyState?.targetScore?.toString() ?? '11',
  );

  useEffect(() => {
    setTargetScoreDraft(lobbyState?.targetScore?.toString() ?? '11');
  }, [lobbyState?.targetScore]);

  const players = lobbyState?.players ?? [];
  const derivedHost =
    session.isHost ||
    players.some((player) => player.id === session.playerId && player.isHost);
  const canStart =
    derivedHost &&
    lobbyState?.status === 'waiting' &&
    lobbyState?.maxPlayers === players.length;
  const settingsLocked = lobbyState?.status === 'running';
  const availableSlots = lobbyState?.availableSlots ?? 0;

  const handleApplyTarget = () => {
    if (!derivedHost) {
      return;
    }
    const value = Number(targetScoreDraft);
    if (Number.isNaN(value)) {
      return;
    }
    onUpdateSettings({ targetScore: value });
  };

  const handleModeChange = (mode) => {
    if (!derivedHost || settingsLocked) {
      return;
    }
    onUpdateSettings({ mode });
  };

  return (
    <div className="panel lobby-panel">
      <div className="panel-heading">
        <h2>Lobby</h2>
        {session.roomCode && (
          <span className="room-pill">Room {session.roomCode}</span>
        )}
      </div>
      <div className="form-group">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          placeholder="e.g. Youssef"
          disabled={!!session.roomCode}
        />
      </div>
      <div className="button-row">
        <button
          type="button"
          onClick={onCreateRoom}
          disabled={!username || !!session.roomCode}
        >
          Create Room
        </button>
        <input
          className="room-input"
          value={roomCodeInput}
          onChange={(event) => onRoomCodeChange(event.target.value)}
          placeholder="ROOM"
          maxLength={6}
          autoComplete="off"
          disabled={!!session.roomCode}
        />
        <button
          type="button"
          onClick={onJoinRoom}
          disabled={!username || !roomCodeInput || !!session.roomCode}
        >
          Join Room
        </button>
      </div>
      {error && <p className="error-banner">{error}</p>}
      {!session.roomCode && (
        <PreLobbySettings
          mode={roomModeChoice}
          targetScore={roomTargetChoice}
          onModeChange={onRoomModeChange}
          onTargetChange={onRoomTargetChange}
        />
      )}
      {session.roomCode ? (
        <div className="room-details">
          <div className="room-status">
            <strong>Status:</strong>{' '}
            <span className={`status-pill status-${lobbyState?.status}`}>
              {lobbyState?.status ?? 'waiting'}
            </span>
            <span className="muted small">
              {availableSlots} open slot{availableSlots === 1 ? '' : 's'}
            </span>
          </div>

          <HostControls
            isHost={derivedHost}
            mode={lobbyState?.mode ?? '1v1'}
            targetScore={targetScoreDraft}
            onTargetScoreChange={setTargetScoreDraft}
            onApplyTarget={handleApplyTarget}
            onModeChange={handleModeChange}
            locked={settingsLocked}
          />

          <div className="player-list">
            <h3>Players</h3>
            <ul>
              {players.map((player) => (
                <li key={player.id}>
                  <div className="player-info">
                    <span>
                      {player.username}{' '}
                      {player.id === session.playerId && (
                        <small className="you-pill">you</small>
                      )}
                    </span>
                    <div className="badges">
                      {player.isHost && <em>Host</em>}
                      {player.team && (
                        <em>{player.team === 'A' ? 'Team A' : 'Team B'}</em>
                      )}
                      <em>{player.score} pts</em>
                    </div>
                  </div>
                  {derivedHost && player.id !== session.playerId && (
                    <div className="player-actions">
                      <button
                        type="button"
                        className="ghost tiny"
                        onClick={() => onPromotePlayer(player.id)}
                        title="Transfer host"
                      >
                        Promote
                      </button>
                      <button
                        type="button"
                        className="danger tiny"
                        onClick={() => onKickPlayer(player.id)}
                        title="Remove from room"
                      >
                        Kick
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {lobbyState?.mode === '2v2' && (
            <TeamLayout teams={lobbyState.teams ?? []} />
          )}

          <div className="lobby-actions">
            {canStart && (
              <button type="button" className="primary" onClick={onStartGame}>
                Start Game ({players.length}/{lobbyState.maxPlayers})
              </button>
            )}
            <button
              type="button"
              className="ghost"
              onClick={onLeaveRoom}
              disabled={!session.roomCode}
            >
              Leave Room
            </button>
          </div>
        </div>
      ) : (
        <p className="muted">
          Pick a username and create or join a room to begin.
        </p>
      )}
    </div>
  );
}

function HostControls({
  isHost,
  mode,
  targetScore,
  onTargetScoreChange,
  onApplyTarget,
  onModeChange,
  locked,
}) {
  if (!isHost) {
    return (
      <div className="host-controls muted">
        Waiting for the host to configure settings.
      </div>
    );
  }

  return (
    <div className="host-controls">
      <div className="config-row">
        <label htmlFor="targetScore">Points to win</label>
        <div className="input-with-button">
          <input
            id="targetScore"
            type="number"
            min={5}
            max={51}
            value={targetScore}
            onChange={(event) => onTargetScoreChange(event.target.value)}
            disabled={locked}
          />
          <button
            type="button"
            className="ghost"
            onClick={onApplyTarget}
            disabled={locked}
          >
            Apply
          </button>
        </div>
      </div>
      <div className="config-row">
        <label>Mode</label>
        <div className="mode-toggle">
          <button
            type="button"
            className={mode === '1v1' ? 'active' : ''}
            onClick={() => onModeChange('1v1')}
            disabled={locked}
          >
            1v1 Duel
          </button>
          <button
            type="button"
            className={mode === '2v2' ? 'active' : ''}
            onClick={() => onModeChange('2v2')}
            disabled={locked}
          >
            2v2 Teams
          </button>
        </div>
      </div>
      {locked && (
        <p className="muted small">Settings are locked while a round is live.</p>
      )}
    </div>
  );
}

function PreLobbySettings({ mode, targetScore, onModeChange, onTargetChange }) {
  return (
    <div className="pre-lobby-settings">
      <h3>New Room Settings</h3>
      <div className="config-row">
        <label>Mode</label>
        <div className="mode-toggle">
          <button
            type="button"
            className={mode === '1v1' ? 'active' : ''}
            onClick={() => onModeChange('1v1')}
          >
            1v1 Duel
          </button>
          <button
            type="button"
            className={mode === '2v2' ? 'active' : ''}
            onClick={() => onModeChange('2v2')}
          >
            2v2 Teams
          </button>
        </div>
      </div>
      <div className="config-row">
        <label htmlFor="pre-target">Points to win</label>
        <input
          id="pre-target"
          type="number"
          min={5}
          max={51}
          value={targetScore}
          onChange={(event) => onTargetChange(event.target.value)}
        />
      </div>
    </div>
  );
}

function TeamLayout({ teams }) {
  return (
    <div className="team-layout">
      <h4>Team Layout</h4>
      <div className="team-layout-grid">
        {teams.map((team) => (
          <div className="team-card" key={team.key}>
            <strong>{team.name}</strong>
            {team.members.length === 0 ? (
              <span className="muted">Empty seat</span>
            ) : (
              team.members.map((member) => (
                <span key={member.id}>{member.username}</span>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

LobbyPanel.propTypes = {
  username: PropTypes.string.isRequired,
  onUsernameChange: PropTypes.func.isRequired,
  roomCodeInput: PropTypes.string.isRequired,
  onRoomCodeChange: PropTypes.func.isRequired,
  onCreateRoom: PropTypes.func.isRequired,
  onJoinRoom: PropTypes.func.isRequired,
  session: PropTypes.shape({
    roomCode: PropTypes.string,
    isHost: PropTypes.bool,
    playerId: PropTypes.string,
  }).isRequired,
  lobbyState: PropTypes.shape({
    status: PropTypes.string,
    players: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        username: PropTypes.string,
      }),
    ),
    mode: PropTypes.string,
    targetScore: PropTypes.number,
    maxPlayers: PropTypes.number,
    availableSlots: PropTypes.number,
    teams: PropTypes.arrayOf(PropTypes.object),
  }),
  onStartGame: PropTypes.func.isRequired,
  onLeaveRoom: PropTypes.func.isRequired,
  roomModeChoice: PropTypes.string.isRequired,
  roomTargetChoice: PropTypes.string.isRequired,
  onRoomModeChange: PropTypes.func.isRequired,
  onRoomTargetChange: PropTypes.func.isRequired,
  onUpdateSettings: PropTypes.func.isRequired,
  onKickPlayer: PropTypes.func.isRequired,
  onPromotePlayer: PropTypes.func.isRequired,
  error: PropTypes.string,
};

HostControls.propTypes = {
  isHost: PropTypes.bool.isRequired,
  mode: PropTypes.string.isRequired,
  targetScore: PropTypes.string.isRequired,
  onTargetScoreChange: PropTypes.func.isRequired,
  onApplyTarget: PropTypes.func.isRequired,
  onModeChange: PropTypes.func.isRequired,
  locked: PropTypes.bool.isRequired,
};

PreLobbySettings.propTypes = {
  mode: PropTypes.string.isRequired,
  targetScore: PropTypes.string.isRequired,
  onModeChange: PropTypes.func.isRequired,
  onTargetChange: PropTypes.func.isRequired,
};

TeamLayout.propTypes = {
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
};

LobbyPanel.defaultProps = {
  lobbyState: null,
  error: '',
};

TeamLayout.defaultProps = {
  teams: [],
};

export default LobbyPanel;
