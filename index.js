const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const server = http.createServer(app);
const io = new socketIO.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));




// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// MongoDB Schema for Room History
const roomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    players: [{
        name: String,
        color: String,
        joinTime: { type: Date, default: Date.now },
        leaveTime: Date,
        isHost: { type: Boolean, default: false }
    }],
    playersJoined: [{
        name: String,
        color: String,
        joinTime: { type: Date, default: Date.now },
        leaveTime: Date
    }],
    gameStarted: { type: Boolean, default: false },
    gameEnded: { type: Boolean, default: false },
    gameEndTime: Date,
    winners: [String],
    createdAt: { type: Date, default: Date.now }
});

const Room = mongoose.model('Room', roomSchema);

// In-memory game state storage for performance
const activeRooms = new Map();
const playerSockets = new Map(); // socketId -> { roomId, playerName, color }

// Helper functions
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function getUniqueRoomId() {
    let roomId;
    do {
        roomId = generateRoomId();
    } while (activeRooms.has(roomId));
    return roomId;
}

function getAvailableColor(room) {
    const colors = ['red', 'green', 'yellow', 'blue'];
    const usedColors = room.players.map(p => p.color);
    return colors.find(color => !usedColors.includes(color));
}

function createInitialGameState() {
    return {
        currentTurn: 'red',
        diceValue: 0,
        gameStarted: false,
        gameEnded: false,
        winners: [],
        players: {
            red: { pieces: [], finished: 0 },
            green: { pieces: [], finished: 0 },
            yellow: { pieces: [], finished: 0 },
            blue: { pieces: [], finished: 0 }
        },
        pieces: {} // pieceId -> { position, pathIndex, player }
    };
}

// Socket.IO event handlers
io.on('connection', (socket) => {
    // console.log(`User connected: ${socket.id}`);

    // Create room
    socket.on('create-room', async (data) => {
        try {
            const { playerName } = data;
            const roomId = getUniqueRoomId();
            
            // Create room in memory
            const room = {
                id: roomId,
                players: [{
                    socketId: socket.id,
                    name: playerName,
                    color: 'red', // Host gets red color
                    isHost: true,
                    joinTime: new Date()
                }],
                gameState: createInitialGameState(),
                maxPlayers: 4,
                playersJoined: []
            };
            
            activeRooms.set(roomId, room);
            playerSockets.set(socket.id, { roomId, playerName, color: 'red' });
            
            // Save to MongoDB for history
            const dbRoom = new Room({
                roomId,
                players: [{
                    name: playerName,
                    color: 'red',
                    isHost: true,
                    joinTime: new Date()
                }]
            });
            await dbRoom.save();
            
            socket.join(roomId);
            socket.emit('room-created', { roomId, playerColor: 'red', isHost: true });
            socket.emit('room-update', { 
                players: room.players.map(p => ({ name: p.name, color: p.color, isHost: p.isHost })),
                gameStarted: room.gameState.gameStarted
            });
            
            // console.log(`Room ${roomId} created by ${playerName}`);
        } catch (error) {
            socket.emit('error', { message: 'Failed to create room' });
            console.error('Create room error:', error);
        }
    });

    // Join room
    socket.on('join-room', async (data) => {
        try {
            const { roomId, playerName } = data;
            const room = activeRooms.get(roomId);
            
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }
            
            if (room.players.length >= room.maxPlayers) {
                socket.emit('error', { message: 'Room is full' });
                return;
            }
            
            if (room.gameState.gameStarted) {
                socket.emit('error', { message: 'Game has already started' });
                return;
            }
            
            // Check if name is already taken
            if (room.players.some(p => p.name === playerName)) {
                socket.emit('error', { message: 'Name already taken' });
                return;
            }
            
            const playerColor = getAvailableColor(room);
            if (!playerColor) {
                socket.emit('error', { message: 'No available colors' });
                return;
            }
            
            // Add player to room
            const newPlayer = {
                socketId: socket.id,
                name: playerName,
                color: playerColor,
                isHost: false,
                joinTime: new Date()
            };
            
            room.players.push(newPlayer);
            playerSockets.set(socket.id, { roomId, playerName, color: playerColor });            
                      
            socket.join(roomId);
            socket.emit('room-joined', { roomId, playerColor, playerName, isHost: false });

            // Notify all players in room
            io.to(roomId).emit('room-update', {
                players: room.players.map(p => ({ name: p.name, color: p.color, isHost: p.isHost })),
                gameStarted: room.gameState.gameStarted
            });

            // Update MongoDB
            const dbRoom = await Room.findOne({ roomId });
            if (dbRoom) {
                dbRoom.players.push({
                    name: playerName,
                    color: playerColor,
                    joinTime: new Date()
                });
                await dbRoom.save();
            }
            
            // console.log(`${playerName} joined room ${roomId} as ${playerColor}`);
        } catch (error) {
            socket.emit('error', { message: 'Failed to join room' });
            console.error('Join room error:', error);
        }
    });

    // Start game
    socket.on('start-game', async (data) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;
            
            const room = activeRooms.get(playerData.roomId);
            if (!room) return;
            
            const player = room.players.find(p => p.socketId === socket.id);
            if (!player || !player.isHost) {
                socket.emit('error', { message: 'Only host can start the game' });
                return;
            }
            
            if (room.players.length < 2) {
                socket.emit('error', { message: 'Need at least 2 players to start' });
                return;
            }
            
            // Initialize game state
            room.gameState.gameStarted = true;
            room.gameState.currentTurn = room.players[0].color; // Host starts
            
            // Initialize pieces for each player
            room.players.forEach(player => {
                for (let i = 1; i <= 4; i++) {
                    const pieceId = `${player.color}-${i}`;
                    room.gameState.pieces[pieceId] = {
                        position: 'home',
                        pathIndex: -1,
                        player: player.color
                    };
                }
            }); 
            
            // Notify all players
            io.to(playerData.roomId).emit('game-started', {
                gameState: room.gameState,
                playerColors: room.players.map(p => p.color)
            });
            
            // Update MongoDB
            const dbRoom = await Room.findOne({ roomId: playerData.roomId });
            if (dbRoom) {
                dbRoom.gameStarted = true;
                await dbRoom.save();
            }

            // console.log(`Game started in room ${playerData.roomId}`);
        } catch (error) {
            socket.emit('error', { message: 'Failed to start game' });
            console.error('Start game error:', error);
        }
    });

    // Handle dice roll
    socket.on('roll-dice', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = activeRooms.get(playerData.roomId);
        if (!room || !room.gameState.gameStarted) return;
        
        if (room.gameState.currentTurn !== playerData.color) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }
        
        // const diceValue = Math.floor(Math.random() * 6) + 1;
        const diceValue = data.diceValue;
        room.gameState.diceValue = diceValue;
        
        // Broadcast dice result to all other players, except the one who rolled
        socket.to(playerData.roomId).emit('dice-rolled', {
            player: playerData.color,
            diceValue: diceValue,
            finalX: data.finalX,
            finalY: data.finalY,
            playerName: playerData.playerName
        });
        
        // console.log(`${playerData.playerName} rolled ${diceValue} in room ${playerData.roomId}`);
    });

    // Handle piece move
    socket.on('move-piece', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = activeRooms.get(playerData.roomId);
        if (!room || !room.gameState.gameStarted) return;
        
        if (room.gameState.currentTurn !== playerData.color) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }

        const { pieceId, newPosition, steps, newPathIndex } = data;

        // Validate move (add your validation logic here)
        if (!room.gameState.pieces[pieceId] || room.gameState.pieces[pieceId].player !== playerData.color) {
            socket.emit('error', { message: 'Invalid piece' });
            return;
        }
        
        // Update piece position
        room.gameState.pieces[pieceId].position = newPosition;
        room.gameState.pieces[pieceId].pathIndex = newPathIndex;
        
        // Broadcast move to all players
        io.to(playerData.roomId).emit('piece-moved', {
            pieceId,
            newPosition,
            newPathIndex,
            player: playerData.color,
            steps
        });
                
        // console.log(`${playerData.playerName} moved piece ${pieceId} in room ${playerData.roomId}`);
    });

    // Handle turn change
    socket.on('end-turn', async (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = activeRooms.get(playerData.roomId);
        if (!room || !room.gameState.gameStarted) return;
        
        if (room.gameState.currentTurn !== playerData.color) return;

        // await playerWon();

        // Find next player
        const currentIndex = room.players.findIndex(p => p.color === room.gameState.currentTurn);
        const nextIndex = (currentIndex + 1) % room.players.length;
        const prevTurn = room.players[currentIndex].color;
        room.gameState.currentTurn = room.players[nextIndex].color;
        room.gameState.diceValue = 0;
        
        // Check if player has won
        if (data?.hasPlayerWon !== undefined && data?.hasPlayerWon === true) {
            // console.log( `==> ${playerData.playerName} has won the game in room ${playerData.roomId}`);
            await playerWon();

            // If game has ended, do not change turn
            if (room.gameState.gameEnded) return;
        }
        
        // Broadcast turn change
        io.to(playerData.roomId).emit('turn-changed', {
            prevTurn,
            currentTurn: room.gameState.currentTurn,
            currentPlayer: room.players.find(p => p.color === room.gameState.currentTurn)?.name
        });
        
        // console.log(`Turn changed to ${room.gameState.currentTurn} in room ${playerData.roomId}`);
    });

    async function playerWon () {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;

        const room = activeRooms.get(playerData.roomId);
        if (!room || !room.gameState.gameStarted) return;

        if (room.gameState.gameEnded) {
            socket.emit('error', { message: 'Game already ended' });
            return;
        }

        // Check if the player has won already
        if (room.gameState.winners && room.gameState.winners.includes(playerData.color)) {
            // socket.emit('error', { message: 'You have already won' });
            return;
        }

        // Set winner
        room.gameState.winners.push(playerData.color);   
        // remove player from active players
        room.players.splice(room.players.findIndex(p => p.color === playerData.color), 1);
        console.dir("room.players", room.players);

        // console.log(`${playerData.playerName} won the game in room ${playerData.roomId}`);

        if (room.gameState.winners.length > room.players.length - 1) {
            await gameEnds(room);
            return;
        }

    }
    
    async function gameEnds(room) {

        room.gameState.gameEnded = true;
        room.gameState.gameEndTime = new Date();

        // Notify all players
        io.to(room.id).emit('game-ended', {
            message: 'Game finished',
            winners: room.gameState.winners,
            winnerNames: room.players.filter(p => room.gameState.winners.includes(p.color)).map(p => p.name)
        });


        // Update MongoDB
        const dbRoom = await Room.findOne({ roomId: room.id });
        if (dbRoom) {
            dbRoom.gameEnded = true;
            dbRoom.winners = room.gameState.winners;
            dbRoom.gameEndTime = new Date();
            await dbRoom.save();
        }

        // console.log(`Game ended in room ${room.id}. Winners: ${room.gameState.winners}`);
    }

    // Handle disconnect
    socket.on('disconnect', async () => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;
            
            const room = activeRooms.get(playerData.roomId);
            if (!room) return;

            
            // Remove player from room
            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex !== -1) {
                const leavingPlayer = room.players[playerIndex];
                room.players.splice(playerIndex, 1);
                
                // If it was their turn, change to next player
                if (room.gameState.currentTurn === leavingPlayer.color) {
                    const nextIndex = room.players.length > 0
                        ? (playerIndex % room.players.length)
                        : -1;

                    if (nextIndex !== -1) {
                        const nextPlayerColor = room.players[nextIndex].color;
                        room.gameState.currentTurn = nextPlayerColor;
                        room.gameState.diceValue = 0;

                        // Notify all players
                        io.to(playerData.roomId).emit('turn-changed', {
                            prevTurn: leavingPlayer.color,                            
                            currentTurn: nextPlayerColor,
                            currentPlayer: room.players[nextIndex].name
                        });

                        // console.log(`Turn changed due to disconnect. Now it's ${nextPlayerColor}'s turn`);
                    }
                }

                //add leaved player to room.playersJoined
                room.playersJoined.push({
                    name: leavingPlayer.name,
                    color: leavingPlayer.color,
                    joinTime: leavingPlayer.joinTime,
                    leaveTime: new Date()
                });

                
                // If room is empty, clean up
                if (room.players.length === 0) {
                    await gameEnds(room);
                    activeRooms.delete(playerData.roomId);
                    // console.log(`Room ${playerData.roomId} deleted - no players left`);
                } else {
                    // If host left, make another player host
                    if (leavingPlayer.isHost && room.players.length > 0) {
                        room.players[0].isHost = true;
                    }
                    
                    // Notify remaining players
                    io.to(playerData.roomId).emit('player-left', {
                        playerName: playerData.playerName,
                        color: playerData.color,
                        remainingPlayers: room.players.map(p => ({ 
                            name: p.name, 
                            color: p.color, 
                            isHost: p.isHost 
                        }))
                    });
                    
                    // If game was in progress, handle accordingly
                    if (room.gameState.gameStarted && room.players.length < 2) {
                        room.gameState.gameEnded = true;
                        io.to(playerData.roomId).emit('game-ended', {
                            message: 'Insufficient players',
                            winners: [],
                            reason: 'Not enough players to continue'
                        });
                    }
                }

                 // Update MongoDB with leave time
                const dbRoom = await Room.findOne({ roomId: playerData.roomId });
                if (dbRoom) {
                    const dbPlayer = dbRoom.players.find(p => p.name === playerData.playerName);
                    if (dbPlayer) {
                        dbPlayer.leaveTime = new Date();
                        await dbRoom.save();
                    }
                }
            }
            
            playerSockets.delete(socket.id);
            // console.log(`Player ${playerData.playerName} disconnected from room ${playerData.roomId}`);
        } catch (error) {
            console.error('Disconnect error:', error);
        }
    });
});

// API endpoints
app.get('/api/room/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = activeRooms.get(roomId);
        
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        
        res.json({
            roomId: room.id,
            players: room.players.map(p => ({ 
                name: p.name, 
                color: p.color, 
                isHost: p.isHost 
            })),
            gameStarted: room.gameState.gameStarted,
            maxPlayers: room.maxPlayers,
            playersJoined: room.playersJoined
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});


// Optional: SPA fallback
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});



const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
    // console.log(`Server running on port ${PORT}`);
});