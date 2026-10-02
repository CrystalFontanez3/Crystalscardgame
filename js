// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {}; // roomId -> { players, deck, hands, state }

function createDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const deck = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push({ suit: s, rank: r });
    }
  }
  // shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

io.on("connection", (socket) => {
  socket.on("joinRoom", ({ roomId, name }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: {},
        deck: createDeck(),
        hands: {},
        state: "waiting",
      };
    }

    rooms[roomId].players[socket.id] = { id: socket.id, name };
    rooms[roomId].hands[socket.id] = [];

    io.to(roomId).emit("roomUpdate", rooms[roomId]);
  });

  socket.on("startGame", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.deck = createDeck();
    for (const playerId of Object.keys(room.players)) {
      room.hands[playerId] = room.deck.splice(0, 5); // deal 5 cards
    }
    room.state = "playing";

    io.to(roomId).emit("roomUpdate", room);
  });

  socket.on("playCard", ({ roomId, cardIndex }) => {
    const room = rooms[roomId];
    if (!room) return;

    const hand = room.hands[socket.id];
    if (!hand || cardIndex < 0 || cardIndex >= hand.length) return;

    const card = hand.splice(cardIndex, 1);
    room.table = room.table || [];
    room.table.push({ playerId: socket.id, card: card[0] });

    io.to(roomId).emit("roomUpdate", room);
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        delete room.hands[socket.id];
        io.to(roomId).emit("roomUpdate", room);
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on :3000");
});
