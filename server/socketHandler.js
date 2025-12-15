const GameManager = require('./game/GameManager');

const manager = new GameManager();

function registerSocketHandlers(io) {
  const socketRoomIndex = new Map();

  io.on('connection', (socket) => {
    socket.on('create_room', ({ username, mode, targetScore }) => {
      try {
        const cleanName = sanitizeUsername(username);
        if (!cleanName) {
          throw new Error('Username is required.');
        }
        const room = manager.createRoom(socket.id, cleanName, {
          mode: normalizeMode(mode),
          targetScore,
        });
        socket.join(room.code);
        socketRoomIndex.set(socket.id, room.code);
        socket.emit('room_created', { roomCode: room.code });
        emitRoomState(io, room.code);
      } catch (error) {
        emitError(socket, error.message);
      }
    });

    socket.on('join_room', ({ roomCode, username }) => {
      try {
        const cleanName = sanitizeUsername(username);
        if (!cleanName) {
          throw new Error('Username is required.');
        }
        const code = normalizeCode(roomCode);
        const room = manager.getRoom(code);
        if (!room) {
          throw new Error('Room not found.');
        }
        if (room.status !== 'waiting') {
          throw new Error('Game already in progress.');
        }
        room.addPlayer(socket.id, cleanName);
        socket.join(code);
        socketRoomIndex.set(socket.id, code);
        socket.emit('joined_room', { roomCode: code });
        emitRoomState(io, code);
      } catch (error) {
        emitError(socket, error.message);
      }
    });

    socket.on('start_game', ({ roomCode }) => {
      try {
        const code = normalizeCode(roomCode);
        const room = manager.getRoom(code);
        if (!room) {
          throw new Error('Room not found.');
        }
        if (!room.isHost(socket.id)) {
          throw new Error('Only the host can start the game.');
        }
        room.startGame();
        emitRoomState(io, code);
      } catch (error) {
        emitError(socket, error.message);
      }
    });

    socket.on('play_card', ({ roomCode, cardId }) => {
      try {
        const code = normalizeCode(roomCode);
        const room = manager.getRoom(code);
        if (!room) {
          throw new Error('Room not found.');
        }
        room.playCard(socket.id, cardId);
        emitRoomState(io, code);
      } catch (error) {
        emitError(socket, error.message);
      }
    });

    socket.on('ready_next_round', ({ roomCode }) => {
      try {
        const code = normalizeCode(roomCode);
        const room = manager.getRoom(code);
        if (!room) {
          throw new Error('Room not found.');
        }
        room.playerReady(socket.id);
        emitRoomState(io, code);
      } catch (error) {
        emitError(socket, error.message);
      }
    });

    socket.on('update_settings', ({ roomCode, targetScore, mode }) => {
      try {
        const code = normalizeCode(roomCode);
        const room = manager.getRoom(code);
        if (!room) {
          throw new Error('Room not found.');
        }
        if (!room.isHost(socket.id)) {
          throw new Error('Only the host can update settings.');
        }
        if (typeof targetScore !== 'undefined') {
          room.setTargetScore(targetScore);
        }
        if (mode) {
          room.setMode(normalizeMode(mode));
        }
        emitRoomState(io, code);
      } catch (error) {
        emitError(socket, error.message);
      }
    });

    socket.on('transfer_host', ({ roomCode, playerId }) => {
      try {
        const code = normalizeCode(roomCode);
        const room = manager.getRoom(code);
        if (!room) {
          throw new Error('Room not found.');
        }
        if (!room.isHost(socket.id)) {
          throw new Error('Only the host can promote another player.');
        }
        if (playerId === socket.id) {
          throw new Error('You are already the host.');
        }
        room.promoteToHost(playerId);
        emitRoomState(io, code);
      } catch (error) {
        emitError(socket, error.message);
      }
    });

    socket.on('kick_player', ({ roomCode, playerId }) => {
      try {
        const code = normalizeCode(roomCode);
        const room = manager.getRoom(code);
        if (!room) {
          throw new Error('Room not found.');
        }
        if (!room.isHost(socket.id)) {
          throw new Error('Only the host can remove players.');
        }
        if (playerId === socket.id) {
          throw new Error('Host cannot kick themselves.');
        }
        const target = room.players.find((p) => p.id === playerId);
        if (!target) {
          throw new Error('Player not found.');
        }
        room.removePlayer(playerId);
        socketRoomIndex.delete(playerId);
        const targetSocket = io.sockets.sockets.get(playerId);
        if (targetSocket) {
          targetSocket.leave(code);
          targetSocket.emit('kicked', { roomCode: code });
        }
        if (room.players.length === 0) {
          manager.removeRoom(code);
          return;
        }
        emitRoomState(io, code);
      } catch (error) {
        emitError(socket, error.message);
      }
    });

    socket.on('leave_room', () => {
      const roomCode = socketRoomIndex.get(socket.id);
      if (!roomCode) {
        return;
      }
      handlePlayerDeparture(io, roomCode, socket.id, socketRoomIndex);
    });

    socket.on('disconnect', () => {
      const roomCode = socketRoomIndex.get(socket.id);
      if (!roomCode) {
        return;
      }
      handlePlayerDeparture(io, roomCode, socket.id, socketRoomIndex);
    });

    socket.on('stop_game', ({ roomCode }) => {
      try {
        const code = normalizeCode(roomCode);
        const room = manager.getRoom(code);
        if (!room) {
          throw new Error('Room not found.');
        }
        if (!room.isHost(socket.id)) {
          throw new Error('Only the host can stop the game.');
        }
        room.stopGame();
        emitRoomState(io, code);
      } catch (error) {
        emitError(socket, error.message);
      }
    });

    socket.on('request_switch', ({ roomCode, targetId }) => {
      try {
        const code = normalizeCode(roomCode);
        const room = manager.getRoom(code);
        if (!room) {
          throw new Error('Room not found.');
        }
        const target = room.requestSwitch(socket.id, targetId);
        const targetSocket = io.sockets.sockets.get(target.id);
        if (!targetSocket) {
          room.pendingSwitch = null;
          throw new Error('Player is not connected.');
        }
        const fromPlayer =
          manager
            .getRoom(code)
            ?.players.find((p) => p.id === socket.id)?.username || 'Player';
        targetSocket.emit('switch_request', {
          fromId: socket.id,
          fromName: fromPlayer,
          roomCode: code,
        });
        emitRoomState(io, code);
      } catch (error) {
        emitError(socket, error.message);
      }
    });

    socket.on('respond_switch', ({ roomCode, accepted }) => {
      try {
        const code = normalizeCode(roomCode);
        const room = manager.getRoom(code);
        if (!room) {
          throw new Error('Room not found.');
        }
        const result = room.respondSwitch(socket.id, !!accepted);
        if (result.swapped) {
          emitRoomState(io, code);
        } else {
          emitRoomState(io, code);
        }
      } catch (error) {
        emitError(socket, error.message);
      }
    });

    socket.on('choose_team', ({ roomCode, team }) => {
      try {
        const code = normalizeCode(roomCode);
        const room = manager.getRoom(code);
        if (!room) {
          throw new Error('Room not found.');
        }
        room.chooseTeam(socket.id, team);
        emitRoomState(io, code);
      } catch (error) {
        emitError(socket, error.message);
      }
    });

    socket.on('choose_team', ({ roomCode, team }) => {
      try {
        const code = normalizeCode(roomCode);
        const room = manager.getRoom(code);
        if (!room) {
          throw new Error('Room not found.');
        }
        room.chooseTeam(socket.id, team);
        emitRoomState(io, code);
      } catch (error) {
        emitError(socket, error.message);
      }
    });
  });
}

function emitRoomState(io, roomCode) {
  const room = manager.getRoom(roomCode);
  if (!room) {
    return;
  }
  room.players.forEach((player) => {
    const payload = room.buildStateForPlayer(player.id);
    if (payload) {
      io.to(player.id).emit('game_update', payload);
    }
  });
  io.to(roomCode).emit('room_update', room.buildLobbyState());
}

function emitError(socket, message) {
  socket.emit('action_error', { message });
}

function sanitizeUsername(value = '') {
  return value.trim().slice(0, 20);
}

function normalizeCode(value = '') {
  return value.trim().toUpperCase();
}

function normalizeMode(value) {
  return value === '2v2' ? '2v2' : '1v1';
}

function handlePlayerDeparture(io, roomCode, socketId, socketRoomIndex) {
  const room = manager.getRoom(roomCode);
  socketRoomIndex.delete(socketId);
  if (!room) {
    return;
  }
  room.removePlayer(socketId);
  if (room.players.length === 0) {
    manager.removeRoom(roomCode);
    return;
  }
  io.sockets.sockets.get(socketId)?.leave(roomCode);
  emitRoomState(io, roomCode);
}

module.exports = {
  registerSocketHandlers,
  emitRoomState,
  manager,
};
