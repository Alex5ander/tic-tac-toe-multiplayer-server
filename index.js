const { randomUUID } = require('crypto');
const { Server, Socket } = require('socket.io');
const server = new Server(3000, { cors: 'https://alex5ander.itch.io/tic-tac-toe-multiplayer' });

class Room {
  /** @param {string} id */
  constructor() {
    this.simbols = ["X", "O"];
    this.id = randomUUID();
    this.clientIds = {};
    this.turn = null;
    this.win = null;
    this.board = new Array(9).fill(0);
  }
  join(id) {
    this.clientIds[id] = this.simbols.splice(Math.floor(Math.random() * this.simbols.length), 1)[0];
  }
  check(simbol) {
    for (let i = 0; i < 3; i++) {
      const horizontal = this.board[i * 3 + 0] == simbol && this.board[i * 3 + 1] == simbol && this.board[i * 3 + 2] == simbol;
      const vertical = this.board[0 * 3 + i] == simbol && this.board[1 * 3 + i] == simbol && this.board[2 * 3 + i] == simbol;
      const firstDiagonal = this.board[0] == simbol && this.board[4] == simbol && this.board[8] == simbol;
      const secondDiagonal = this.board[2] == simbol && this.board[4] == simbol && this.board[6] == simbol;
      if (horizontal || vertical || firstDiagonal || secondDiagonal) {
        return true;
      }
    }
    return false;
  }

  isFull() { return this.board.every(e => e != 0); }
}

/** @type {Room[]} */
let rooms = [];

/** 
 * @param {Socket} socket
 * @param {Room} room 
 * */
const OnDisconnect = (socket, room) => {
  socket.on('disconnect', () => {
    rooms = rooms.filter(r => r.id != room.id);
    if (!room.win) {
      socket.in(room.id).emit("opponent_disconnected");
      console.log('disconnected: ' + socket.id);
    }
  });
}

/** 
 * @param {Socket} socket
 * @param {Room} room 
 * */
const OnMessage = (socket, room) => {
  socket.on('click', (data) => {
    if (isNaN(data) || data < 0 || data > 8) {
      server.to(room).disconnectSockets();
      return;
    }
    if (room.win != null) {
      return;
    }
    console.log("room: " + room.id);
    console.log("client: " + socket.id + " enviou: " + data);
    if (room.turn == socket.id) {
      if (room.board[data] == 0) {
        const simbol = room.clientIds[socket.id];
        room.board[data] = simbol;
        room.turn = Object.keys(room.clientIds).find(e => e != socket.id);
        server.to(room.id).emit('update', { simbol, index: data });

        if (room.check(simbol)) {
          socket.emit('win');
          socket.in(room.id).emit('lost');
          room.win = socket.id;
        } else if (room.isFull()) {
          server.in(room.id).emit('draw');
        }
        else {
          socket.emit('opponent_turn');
          server.to(room.turn).emit('your_turn');
        }
      }
    }
  });
}

/** @param {Socket} socket */
const OnConnection = (socket) => {
  console.log("client connected: " + socket.id);
  let room = rooms.find(room => Object.keys(room.clientIds).length == 1);
  if (!room) {
    room = new Room();
    rooms.push(room);
  } else {
    console.log("game started on room: " + room.id);
  }

  room.join(socket.id);
  socket.join(room.id);
  socket.emit('simbol', room.clientIds[socket.id]);

  if (room.simbols.length == 0) {
    room.turn = Object.keys(room.clientIds)[Math.floor(Math.random() * 2)];
    console.log(Object.keys(room.clientIds))
    server.to(room.id).emit("start");
    server.to(room.turn).emit("your_turn");
  }

  OnMessage(socket, room);
  OnDisconnect(socket, room);
};

server.on('connection', OnConnection);