const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "https://tic-tac-toe-h2tc.onrender.com",
    methods: ["GET", "POST"],
  },
});

const port = 5000;
const games = {};
const scores = {};
const roomUsers = {}; // Tracks usernames: { "room1": ["Alice", "Bob"] }
app.use(cors());

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on('join_room', (data) => {
    const { username, room, game } = data;

    // 1. Initialize room user list if it doesn't exist
    if (!roomUsers[room]) roomUsers[room] = [];

    // 2. Check for duplicate username in this specific room
    if (roomUsers[room].includes(username)) {
      return socket.emit("error_message", "Username already taken in this room.");
    }

    if (roomUsers[room].length < 2) {
      socket.join(room);
      roomUsers[room].push(username);
      
      // Store data on the socket for cleanup during disconnect
      socket.username = username;
      socket.room = room;

      console.log(`User ${username} joined room: ${room}`);

      // 3. Persist game state: Only set if it's a brand new room
      if (!games[room]) games[room] = game;

      if (roomUsers[room].length === 2) {
        // Second player joined: Tell everyone to start
        io.to(room).emit("begin_game", { firstPlayer: roomUsers[room][0], secondPlayer: roomUsers[room][1] });
      } else {
        // First player joined: Tell them to wait
        io.to(room).emit('waiting', "Waiting for Player 2...");

      }
    } else {
      socket.emit("error_message", "Room is full.");
    }
  });

socket.on("makeMove", (data) => {
  if (data.roomName) {
    games[data.roomName] = data.updatedGame;
    
    // Determine who is next based on the index sent from frontend
    // data.ind should represent the person who JUST moved.
    let nextUserIndex = (data.ind === 0) ? 1 : 0;
    let nextUserName = roomUsers[data.roomName][nextUserIndex];

    // Emit the update back to everyone
    io.to(data.roomName).emit("moveMade", {
      updatedGame: data.updatedGame,
      nextUser: nextUserName,
      nextInd: nextUserIndex // Helpful for frontend to track its own index
    });
  }
});

  socket.on("resetGame", (data) => {
    if (data.room) {
      games[data.room] = data.newGame;
      io.to(data.room).emit("gameReset", data.newGame);
    }
  });

  socket.on("win", (data) => {
    if (data.room) {
      scores[data.room] = data.nextScores;
      io.to(data.room).emit("won", data.nextScores);
    }
  });

  // Combined disconnect logic
  socket.on('disconnect', () => {
    const { username, room } = socket;
    if (room && roomUsers[room]) {
      // Remove username from the room tracking
      roomUsers[room] = roomUsers[room].filter(u => u !== username);
      console.log(`User ${username} left room ${room}`);
      
      // Clean up empty rooms
      if (roomUsers[room].length === 0) {
        delete roomUsers[room];
        delete games[room];
      }
    }
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);

});
