import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Socket.IO logic
  const rooms = new Map<string, {
    hostId: string;
    players: { id: string; name: string; color: string }[];
    buzzedPlayerId: string | null;
  }>();

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("createRoom", (roomId: string) => {
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          hostId: socket.id,
          players: [],
          buzzedPlayerId: null
        });
      } else {
        const room = rooms.get(roomId)!;
        room.hostId = socket.id;
      }
      socket.join(roomId);
      console.log(`Room created/rejoined: ${roomId}`);
      // Send existing players to the host
      const room = rooms.get(roomId)!;
      socket.emit("playerJoined", room.players);
    });

    socket.on("joinRoom", ({ roomId, player }) => {
      const room = rooms.get(roomId);
      if (room) {
        // Check if player already exists
        const existingPlayerIndex = room.players.findIndex(p => p.id === player.id);
        if (existingPlayerIndex === -1) {
           room.players.push(player);
        } else {
           room.players[existingPlayerIndex] = player;
        }
        socket.join(roomId);
        io.to(roomId).emit("playerJoined", room.players);
        console.log(`Player ${player.name} joined room ${roomId}`);
      } else {
        socket.emit("error", "Room not found");
      }
    });

    socket.on("buzz", ({ roomId, playerId }) => {
      const room = rooms.get(roomId);
      if (room && !room.buzzedPlayerId) {
        room.buzzedPlayerId = playerId;
        io.to(roomId).emit("playerBuzzed", playerId);
        io.to(roomId).emit("buzzLocked", playerId); // Tell all clients someone buzzed
        console.log(`Player ${playerId} buzzed in room ${roomId}`);
      }
    });

    socket.on("resetBuzzer", (roomId: string) => {
      const room = rooms.get(roomId);
      if (room) {
        room.buzzedPlayerId = null;
        io.to(roomId).emit("buzzerReset");
        console.log(`Buzzer reset in room ${roomId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      // Optional: Handle host disconnect or player disconnect
    });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
