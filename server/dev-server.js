const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { registerSocketHandlers } = require('./socketHandler');

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.get('/', (req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

registerSocketHandlers(io);

server.listen(PORT, () => {
  /* eslint-disable no-console */
  console.log(`Chkobba socket server running on ${PORT}`);
});
