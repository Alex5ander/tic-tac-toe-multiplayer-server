const { randomUUID } = require('crypto');
const { Server, Socket } = require('socket.io');
const server = new Server(3000, { cors: '*' });

class Room {
  /** @param {string} id */
  constructor(id) {
    this.id = randomUUID();
    this.clientIds = {
      [id]: "X"
    }
    this.turn = id;
    this.board = new Array(9).fill(0);
    this.win = null;
  }
  join(id) {
    this.clientIds[id] = "O";
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
    socket.in(room.id).disconnectSockets(true);
    rooms = rooms.filter(r => r.id != room.id);
    console.log('disconnected: ' + socket.id);
  });
}

/** 
 * @param {Socket} socket
 * @param {Room} room 
 * */
const OnMessage = (socket, room) => {
  socket.on('click', (data, success) => {
    if (isNaN(data)) {
      server.to(room).disconnectSockets();
      return;
    }
    if (room.win != null) {
      return;
    }
    console.log("room: " + room.id);
    console.log("client: " + socket.id + " enviou: " + data);
    if (room.turn == socket.id) {
      if (data < room.board.length && room.board[data] == 0) {
        const simbol = room.clientIds[socket.id];
        room.board[data] = simbol;
        server.to(room.id).emit('update', { simbol, index: data });
        success();

        room.turn = Object.keys(room.clientIds).find(e => e != socket.id);
        server.to(room.turn).emit('your-turn');

        if (room.check(simbol)) {
          socket.emit('win');
          socket.in(room.id).emit('end-game');
          room.win = socket.id;
        } else if (room.isFull()) {
          server.in(room.id).emit('end-game');
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
    room = new Room(socket.id);
    rooms.push(room);
    socket.join(room.id);
    socket.emit('simbol', room.clientIds[socket.id]);
    server.to(room.turn).emit('your-turn');
  } else {
    room.join(socket.id);
    socket.join(room.id);
    socket.emit('simbol', room.clientIds[socket.id]);
    server.to(room.id).emit("start");
    console.log("game started on room: " + room.id);
  }

  OnMessage(socket, room);
  OnDisconnect(socket, room);
};

server.on('connection', OnConnection);

