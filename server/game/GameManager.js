const crypto = require('crypto');
const GameRoom = require('./GameRoom');

const ROOM_CODE_LENGTH = 6;
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class GameManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(hostId, username, options = {}) {
    const code = this._generateUniqueCode();
    const room = new GameRoom(code, options);
    room.addPlayer(hostId, username);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  removeRoom(code) {
    this.rooms.delete(code);
  }

  _generateUniqueCode() {
    let code = buildCode();
    while (this.rooms.has(code)) {
      code = buildCode();
    }
    return code;
  }
}

function buildCode() {
  const bytes = crypto.randomBytes(ROOM_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = bytes[i] % ROOM_ALPHABET.length;
    code += ROOM_ALPHABET[index];
  }
  return code;
}

module.exports = GameManager;
