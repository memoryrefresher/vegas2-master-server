const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parsing for incoming matchmaking payloads
app.use(express.json());

// In-memory database array to store active peer lobbies
let activeLobbies = [];

// LOBBY EXPIRATION TIMEOUT (in milliseconds)
// If a player closes their game or crashes, remove them after 45 seconds of silence
const LOBBY_TIMEOUT = 45000; 

// 1. ROOT ROUTE (Fixes the "Cannot GET /" message in your browser)
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>R6V2 Master Server</title></head>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #121212; color: #ffffff;">
                <h1>GBG chemmyS - R6V2 Matchmaker</h1>
                <p style="color: #00ff00;">● System Status: ONLINE</p>
                <p>Lobby API Target: <a href="/api/lobbies" style="color: #38bdf8;">/api/lobbies</a></p>
            </body>
        </html>
    `);
});

// 2. HOST LOBBY REGISTRATION / HEARTBEAT ENDPOINT
app.post('/api/host', (req, res) => {
    const { lobbyName, gameMode, port, currentPlayers, maxPlayers } = req.body;
    
    // Automatically extract the host's actual public internet IP address
    const hostIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!lobbyName || !port) {
        return res.status(400).json({ error: "Missing required lobby configuration parameters." });
    }

    // Check if this host already has an active session listed
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
        // Update existing registration timestamp (Heartbeat)
        activeLobbies[existingLobbyIndex] = lobbyData;
        console.log(`[HEARTBEAT] Ping received from: "${lobbyName}" (${hostIp})`);
    } else {
        // Create brand new registration entry
        activeLobbies.push(lobbyData);
        console.log(`[NEW LOBBY] Registered: "${lobbyName}" | Mode: ${gameMode} | Host IP: ${hostIp}`);
    }

    res.status(200).json({ status: "Success", message: "Lobby registered successfully." });
});

// 3. SERVER LIST DISCOVERY ENDPOINT (Used by launcher.js)
app.get('/api/lobbies', (req, res) => {
    const now = Date.now();
    
    // Clean out stale/disconnected lobbies immediately before serving the list
    activeLobbies = activeLobbies.filter(lobby => (now - lobby.lastSeen) < LOBBY_TIMEOUT);

    // Send the verified active peer list back to the players
    res.json({ servers: activeLobbies });
});

// Start the network daemon
app.listen(PORT, () => {
    console.log(`Matchmaking master server online and listening on port ${PORT}`);
});
