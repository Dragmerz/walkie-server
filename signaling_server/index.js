const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const jwt = require("jsonwebtoken");
app.use(cors());

const SECRET = "super_secret_walkie_key"; // change later

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let rooms = {}; // { roomId: [clients] }

// Simple health check
app.get("/", (req, res) => {
  res.send("Walkie Talkie Signaling Server Running");
});

// Simple demo login (replace with DB later)
app.post("/login", (req, res) => {
  const { username, roomId } = req.body;

  if (!username || !roomId) {
    return res.status(400).json({ error: "Missing username or roomId" });
  }

  const token = jwt.sign(
    { username, roomId },
    SECRET,
    { expiresIn: "12h" }
  );

  res.json({ token });
});

// WebSocket connection
wss.on("connection", (ws, req) => {
  console.log("New client connected");

  ws.on("message", (message) => {
  try {
    const data = JSON.parse(message);

    // AUTH
    if (data.type === "auth") {
      const decoded = jwt.verify(data.token, SECRET);
      ws.user = decoded;
      ws.roomId = decoded.roomId;

      if (!rooms[ws.roomId]) {
        rooms[ws.roomId] = [];
      }

      rooms[ws.roomId].push(ws);
      console.log(`${decoded.username} joined room ${ws.roomId}`);
      return;
    }

    if (!ws.roomId) return;

    // Relay signaling messages
    const allowedTypes = [
      "offer",
      "answer",
      "ice",
      "ptt_start",
      "ptt_stop"
    ];

    if (allowedTypes.includes(data.type)) {
      rooms[ws.roomId].forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            from: ws.user.username,
            type: data.type,
            data: data.data
          }));
        }
      });
    }

  } catch (err) {
    console.error("Error:", err.message);
  }
});

  ws.on("close", () => {
    if (ws.roomId && rooms[ws.roomId]) {
      rooms[ws.roomId] = rooms[ws.roomId].filter(c => c !== ws);
      console.log("Client disconnected");
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

});
