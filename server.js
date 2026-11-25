const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Раздаём папку public (там лежит index.html с игрой)
app.use(express.static(path.join(__dirname, 'public')));

// Все игроки: id -> {x, y, name, color}
const players = {};
// Позиция соседа (общая для всех)
let neighbor = { x: 1200, y: 900, angle: 0, state: 'run' };
// Кто сейчас хост (считает соседа)
let hostId = null;

io.on('connection', (socket) => {
  console.log('Подключился:', socket.id);

  // Создаём игрока
  players[socket.id] = {
    x: 1200,
    y: 1600,
    r: 16,
    name: 'Игрок-' + socket.id.slice(0, 4),
    color: 'hsl(' + Math.floor(Math.random() * 360) + ',70%,55%)'
  };

  // Если хост ещё не назначен — делаем этого игрока хостом
  if (!hostId) {
    hostId = socket.id;
    console.log('Хост соседа:', hostId);
  }

  // Отправляем новому игроку: его id, всех игроков, соседа и кто хост
  socket.emit('init', {
    id: socket.id,
    players,
    neighbor,
    hostId
  });

  // Сообщаем остальным о новом игроке
  socket.broadcast.emit('playerJoined', { id: socket.id, ...players[socket.id] });

  // Игрок двинулся
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y
      });
    }
  });

  // Хост прислал новую позицию соседа — рассылаем всем
  socket.on('neighbor', (data) => {
    if (socket.id === hostId) {
      neighbor = data;
      socket.broadcast.emit('neighborMoved', data);
    }
  });

  // Игрок отключился
  socket.on('disconnect', () => {
    console.log('Отключился:', socket.id);
    delete players[socket.id];

    // Если ушёл хост — назначаем нового
    if (socket.id === hostId) {
      const ids = Object.keys(players);
      hostId = ids.length > 0 ? ids[0] : null;
      if (hostId) {
        console.log('Новый хост соседа:', hostId);
        io.emit('newHost', hostId);
      }
    }

    io.emit('playerLeft', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Сервер запущен на порту ' + PORT);
});