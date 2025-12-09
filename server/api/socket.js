const { Server } = require('socket.io');
const { registerSocketHandlers } = require('../socketHandler');

let io;

module.exports = (req, res) => {
  if (!res.socket) {
    res.status(500).send('Socket not available');
    return;
  }

  res.setHeader('ngrok-skip-browser-warning', '1');
  console.log('[socket API] ngrok warning header emitted');

  if (!io) {
    io = new Server(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
    });
    registerSocketHandlers(io);
  }

  res.end();
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
