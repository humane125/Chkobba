import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import LobbyPanel from './components/LobbyPanel';
import GameBoard from './components/GameBoard';
import './App.css';

const initialSession = { roomCode: '', isHost: false, playerId: '' };

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomModeChoice, setRoomModeChoice] = useState('1v1');
  const [roomTargetChoice, setRoomTargetChoice] = useState('11');
  const [session, setSession] = useState(initialSession);
  const [lobbyState, setLobbyState] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const config = resolveSocketConfig();
    const client = io(config.serverUrl, { path: config.socketPath });
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('Connecting to socket server:', config.serverUrl, config.socketPath);
    }
    setSocket(client);

    const handleConnect = () => {
      setConnected(true);
      setSession((prev) => ({ ...prev, playerId: client.id }));
    };
    const handleDisconnectOnly = () => setConnected(false);
    const handleDisconnect = () => {
      handleDisconnectOnly();
      resetClientState();
    };

    client.on('connect', handleConnect);
    client.on('disconnect', handleDisconnect);
    client.on('room_update', (payload) => {
      setLobbyState(payload);
      setSession((prev) => {
        if (!prev.roomCode) {
          return prev;
        }
        const playerId = prev.playerId || client.id;
        const isHost =
          payload.players?.some((player) => player.id === playerId && player.isHost) ??
          prev.isHost;
        if (isHost === prev.isHost) {
          return prev;
        }
        return { ...prev, isHost };
      });
    });
    client.on('game_update', (payload) => {
      setGameState(payload);
      setSession((prev) => {
        const isHost =
          payload.players?.some(
            (player) => player.id === payload.selfId && player.isHost,
          ) || prev.isHost;
        const playerId = payload.selfId || prev.playerId || client.id;
        return { ...prev, isHost, playerId };
      });
    });
    client.on('room_created', ({ roomCode }) => {
      setSession({ roomCode, isHost: true, playerId: client.id });
      setError('');
    });
    client.on('joined_room', ({ roomCode }) => {
      setSession({ roomCode, isHost: false, playerId: client.id });
      setError('');
    });
    client.on('action_error', ({ message }) => setError(message));
    client.on('kicked', () => {
      setError('You were removed by the host.');
      resetClientState();
    });

    return () => {
      client.off('connect', handleConnect);
      client.off('disconnect', handleDisconnect);
      client.disconnect();
    };
  }, []);

  const resetClientState = () => {
    setSession(initialSession);
    setLobbyState(null);
    setGameState(null);
    setRoomCodeInput('');
  };

  const emit = (event, data) => {
    if (!socket) {
      return;
    }
    socket.emit(event, data);
  };

  const handleCreateRoom = () => {
    if (!username || session.roomCode) {
      return;
    }
    emit('create_room', {
      username,
      mode: roomModeChoice,
      targetScore: Number(roomTargetChoice) || undefined,
    });
  };

  const handleJoinRoom = () => {
    if (!username || !roomCodeInput || session.roomCode) {
      return;
    }
    emit('join_room', { username, roomCode: roomCodeInput });
  };

  const handleStartGame = () => {
    if (!session.roomCode) {
      return;
    }
    emit('start_game', { roomCode: session.roomCode });
  };

  const handlePlayCard = (cardId) => {
    if (!session.roomCode) {
      return;
    }
    emit('play_card', { roomCode: session.roomCode, cardId });
  };

  const handleLeaveRoom = () => {
    if (!session.roomCode) {
      return;
    }
    emit('leave_room');
    resetClientState();
    setError('');
  };

  const handleUpdateSettings = (updates) => {
    if (!session.roomCode) {
      return;
    }
    emit('update_settings', { roomCode: session.roomCode, ...updates });
  };

  const handleKickPlayer = (playerId) => {
    if (!session.roomCode) {
      return;
    }
    if (playerId === session.playerId) {
      return;
    }
    emit('kick_player', { roomCode: session.roomCode, playerId });
  };

  const handlePromotePlayer = (playerId) => {
    if (!session.roomCode) {
      return;
    }
    emit('transfer_host', { roomCode: session.roomCode, playerId });
  };

  const handleReadyNextRound = () => {
    if (!session.roomCode) {
      return;
    }
    emit('ready_next_round', { roomCode: session.roomCode });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Chkobba Online</h1>
          <p>Quick multiplayer games with unique room codes.</p>
        </div>
        <div className={`connection-indicator ${connected ? 'online' : 'offline'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </header>

      <main className="app-layout">
        <LobbyPanel
          username={username}
          onUsernameChange={(value) => {
            setUsername(value);
            setError('');
          }}
          roomCodeInput={roomCodeInput}
          onRoomCodeChange={(value) => setRoomCodeInput(value.toUpperCase())}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          session={session}
          lobbyState={lobbyState}
          onStartGame={handleStartGame}
          onLeaveRoom={handleLeaveRoom}
          roomModeChoice={roomModeChoice}
          roomTargetChoice={roomTargetChoice}
          onRoomModeChange={setRoomModeChoice}
          onRoomTargetChange={setRoomTargetChoice}
          onUpdateSettings={handleUpdateSettings}
          onKickPlayer={handleKickPlayer}
          onPromotePlayer={handlePromotePlayer}
          error={error}
        />
        <GameBoard
          session={session}
          gameState={gameState}
          onPlayCard={handlePlayCard}
          onContinueRound={handleReadyNextRound}
        />
      </main>
    </div>
  );
}

function resolveSocketConfig() {
  if (typeof window === 'undefined') {
    return {
      serverUrl: import.meta.env.VITE_SERVER_URL || 'http://localhost:4000',
      socketPath: import.meta.env.VITE_SOCKET_PATH || '/socket.io',
    };
  }
  const params = new URLSearchParams(window.location.search);
  const paramServer = params.get('server');
  const paramPath = params.get('socketPath');
  if (paramServer) {
    window.localStorage.setItem('CHKOBBA_SERVER_URL', paramServer);
  }
  if (paramPath) {
    window.localStorage.setItem('CHKOBBA_SOCKET_PATH', paramPath);
  }
  const storedServer = window.localStorage.getItem('CHKOBBA_SERVER_URL');
  const storedPath = window.localStorage.getItem('CHKOBBA_SOCKET_PATH');
  const serverUrl =
    paramServer ||
    storedServer ||
    import.meta.env.VITE_SERVER_URL ||
    window.__CHKOBBA_SERVER_URL__ ||
    'http://localhost:4000';
  const socketPath =
    paramPath ||
    storedPath ||
    import.meta.env.VITE_SOCKET_PATH ||
    window.__CHKOBBA_SOCKET_PATH__ ||
    '/socket.io';
  return { serverUrl, socketPath };
}

export default App;
