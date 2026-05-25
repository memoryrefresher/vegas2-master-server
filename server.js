const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Tell Express it is running behind Render's reverse proxy 
// This makes req.ip clean and trustworthy
app.set('trust proxy', 1);

// Enable JSON parsing for incoming matchmaking payloads
app.use(express.json());

// In-memory database array to store active peer lobbies
let activeLobbies = [];

// LOBBY EXPIRATION TIMEOUT (in milliseconds)
const LOBBY_TIMEOUT = 45000; 

// 1. ROOT ROUTE 
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
    
    // 1. Grab raw incoming IP address from proxy headers
    let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let hostIp = "127.0.0.1"; // Fallback

    if (rawIp) {
        // THE FIX: Split the string by commas and grab the very first IP (Index 0)
        hostIp = rawIp.split(',')[0].trim();
        
        // 2. IP SANITIZATION: Strip out IPv6 subnet mapping strings
        if (hostIp.startsWith('::ffff:')) {
            hostIp = hostIp.slice(7);
        }
    }

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
        activeLobbies[existingLobbyIndex] = lobbyData;
        console.log(`[HEARTBEAT] Ping received from: "${lobbyName}" (${hostIp})`);
    } else {
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
