const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let activeLobbies = [];
const LOBBY_TIMEOUT = 45000; 

// 1. HOST LOBBY / UPDATE HEARTBEAT
app.post('/api/host', (req, res) => {
    const { lobbyName, gameMode, port, currentPlayers, maxPlayers } = req.body;
    const hostIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!lobbyName || !port) {
        return res.status(400).json({ error: "Missing required lobby configuration parameters." });
    }

    const existingLobbyIndex = activeLobbies.findIndex(l => l.ip === hostIp && l.port === port);

    const lobbyData = {
        ip: hostIp,
        port: parseInt(port),
        lobbyName,
        gameMode: gameMode || "Survival",
        players: `${currentPlayers || 1}/${maxPlayers || 16}`,
        lastSeen: Date.now()
    };

    if (existingLobbyIndex !== -1) {
        activeLobbies[existingLobbyIndex] = lobbyData;
        console.log(`[HEARTBEAT] Lobby refreshed: "${lobbyName}" from IP: ${hostIp}`);
    } else {
        activeLobbies.push(lobbyData);
        console.log(`[NEW LOBBY REGISTERED] Name: "${lobbyName}" | Mode: ${gameMode} | Host IP: ${hostIp}`);
    }

    res.status(200).json({ status: "Success", message: "Lobby registered/refreshed." });
});

// 2. FETCH ACTIVE LOBBIES
app.get('/api/lobbies', (req, res) => {
    const now = Date.now();
    activeLobbies = activeLobbies.filter(lobby => (now - lobby.lastSeen) < LOBBY_TIMEOUT);
    res.json({ servers: activeLobbies });
});

app.listen(PORT, () => {
    console.log(`Matchmaking master server online running on port ${PORT}`);
});