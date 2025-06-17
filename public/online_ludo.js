
import toast from './toast.js';

// Import your existing utility functions
import { arrangePiecesInCell, animatePieceMovementToTargetIndex,
    animatePieceToCell, restartAudio, startHeartbeat, 
    stopHeartbeat, changeDiceColor, roundoff,
} from "./utils_ludo.js";

// Socket.IO connection
const socket = io();

// Game state variables (keep your existing ones and add these)
let roomId = null;
let playerColor = null;
let playerName = null;
let isHost = false;
let playersInRoom = [];
let gameState = null;

// DOM elements for room management
const board = document.getElementById('ludo-board');
const dice = document.getElementById('dice');
const currentPlayerDisplay = document.getElementById('current-player-color');
const messageBox = document.getElementById('message-box');
const messageText = document.getElementById('message-text');
const messageButton = document.getElementById('message-button');
const diceRollingAudio = new Audio('media/sounds/Rolling_1s.mp3'); // Sound for dice rolling
const roomCreationDiv = document.getElementById('room-creation');
const gameAreaDiv = document.getElementById('game-area');
const roomIdDisplay = document.getElementById('room-id-display');
const playersListDiv = document.getElementById('players-list');
const startGameBtn = document.getElementById('start-game-btn');
const roomIdInput = document.getElementById('room-id-input');
const playerNameInput = document.getElementById('player-name-input');
let pieceSize = 20; // Size of a piece for positioning

// Keep all your existing game variables and constants
// const board = document.getElementById('ludo-board');
// const dice = document.getElementById('dice');
// ... all your existing variables


// Define player colors and their starting/path/home positions
const players = {
    'red': {
        color: 'red',
        startCell: 'cell-7-2', // Red's actual start cell (index 0 in path)
        homePathTurn: 'cell-8-1', // Start of red's home path
        pieces: [], // Array to hold piece elements
        homeCircles: ['home-red-1', 'home-red-2', 'home-red-3', 'home-red-4'],
        pathOffset: 0, // Offset for red's path in the common path array
        finishCell: 'cell-8-7' // Center finish cell
    },
    'green': {
        color: 'green',
        startCell: 'cell-2-9', // Green's actual start cell
        homePathTurn: 'cell-1-8', // Start of green's home path
        pieces: [],
        homeCircles: ['home-green-1', 'home-green-2', 'home-green-3', 'home-green-4'],
        pathOffset: 13, // Offset for green's path
        finishCell: 'cell-7-8'
    },
    'yellow': {
        color: 'yellow',
        startCell: 'cell-14-7', // Yellow's actual start cell
        homePathTurn: 'cell-15-8', // Start of yellow's home path
        pieces: [],
        homeCircles: ['home-yellow-1', 'home-yellow-2', 'home-yellow-3', 'home-yellow-4'],
        pathOffset: 26, // Offset for yellow's path
        finishCell: 'cell-9-8'
    },
    'blue': {
        color: 'blue',
        startCell: 'cell-9-14', // Blue's actual start cell
        homePathTurn: 'cell-8-15', // Start of blue's home path
        pieces: [],
        homeCircles: ['home-blue-1', 'home-blue-2', 'home-blue-3', 'home-blue-4'],
        pathOffset: 39, // Offset for blue's path
        finishCell: 'cell-8-9'
    }
};

const playerColorsInGame = []; // Sequence of players in the game



let currentTurn = 'red';
let diceValue = 0;
let selectedPiece = null;
let gameStarted = false;

// Common path for all players (52 cells)
// This array defines the sequence of cells for pieces to move on.
// The indices correspond to the grid positions (row-col).
const commonPath = [
    'cell-7-1', 'cell-7-2', 'cell-7-3', 'cell-7-4', 'cell-7-5', 'cell-7-6', // Red's initial path (6 cells)
    'cell-6-7', 'cell-5-7', 'cell-4-7', 'cell-3-7', 'cell-2-7', 'cell-1-7', 'cell-1-8', // Path towards green (6 cells)
    'cell-1-9', 'cell-2-9', 'cell-3-9', 'cell-4-9', 'cell-5-9', 'cell-6-9', // Green's initial path (6 cells)
    'cell-7-10', 'cell-7-11', 'cell-7-12', 'cell-7-13', 'cell-7-14', 'cell-7-15', 'cell-8-15', // Path towards yellow (6 cells)
    'cell-9-15', 'cell-9-14', 'cell-9-13', 'cell-9-12', 'cell-9-11', 'cell-9-10', // Yellow's initial path (6 cells)
    'cell-10-9', 'cell-11-9', 'cell-12-9', 'cell-13-9', 'cell-14-9', 'cell-15-9', 'cell-15-8',// Path towards blue (6 cells)
    'cell-15-7', 'cell-14-7', 'cell-13-7', 'cell-12-7', 'cell-11-7', 'cell-10-7', // Blue's initial path (6 cells)
    'cell-9-6', 'cell-9-5', 'cell-9-4', 'cell-9-3', 'cell-9-2', 'cell-9-1','cell-8-1', // Path back to red (6 cells)
];

// Home paths for each player (6 cells each)
const homePaths = {
    'red': ['cell-8-2', 'cell-8-3', 'cell-8-4', 'cell-8-5', 'cell-8-6', 'cell-8-7'],
    'green': ['cell-2-8', 'cell-3-8', 'cell-4-8', 'cell-5-8', 'cell-6-8', 'cell-7-8'],
    'yellow': ['cell-14-8', 'cell-13-8', 'cell-12-8', 'cell-11-8', 'cell-10-8', 'cell-9-8'],
    'blue': ['cell-8-14', 'cell-8-13', 'cell-8-12', 'cell-8-11', 'cell-8-10', 'cell-8-9']
};

// Safe cells (marked with shield)
const safeCells = [
    'cell-9-3', 'cell-7-2', 'cell-3-7','cell-2-9', 'cell-7-13', 'cell-9-14', 'cell-13-9','cell-14-7'
];

const fullPaths = {};

function initializeFullPaths() {
    ['red', 'green', 'yellow', 'blue'].forEach(color => {
        let fullPath = [];

        let Idx = commonPath.indexOf(players[color].startCell);
        let pathCell;

        // Append common path from startCell to homePathTurn (with wrap-around)
        while (true) {
            pathCell = commonPath[Idx % commonPath.length];
            fullPath.push(pathCell);
            Idx++;

            if (pathCell === players[color].homePathTurn) break;
        }

        // Append home path cells
        fullPath = fullPath.concat(homePaths[color]);

        // Store in fullPaths
        fullPaths[color] = fullPath;
    });
}

initializeFullPaths();


/**
 * Displays a message box with the given text.
 * @param {string} message - The message to display.
 * @param {boolean} isLoading - If true, shows a loading indicator and no OK button.
 */
function showMessage(message, isLoading = false) {
    messageText.innerHTML = message; // Use innerHTML for potential loading spinner
    
    // messageBox.style.display = 'block';
    messageBox.classList.add("show");
    if (isLoading) {
        messageButton.style.display = 'none';
    } else {
        messageButton.style.display = 'block';
        messageButton.onclick = () => {
            messageBox.classList.remove("show");
            // Additional logic after message is dismissed, if needed
        };
    }
}

/**
 * Initializes the Ludo board by creating cells and placing home areas.
 */
function initializeBoard() {
    for (let r = 1; r <= 15; r++) {
        for (let c = 1; c <= 15; c++) {
            // Skip cells covered by home areas and center
            if ((r >= 1 && r <= 6 && c >= 1 && c <= 6) || // Red home
                (r >= 1 && r <= 6 && c >= 10 && c <= 15) || // Green home
                (r >= 10 && r <= 15 && c >= 1 && c <= 6) || // Yellow home
                (r >= 10 && r <= 15 && c >= 10 && c <= 15) || // Blue home
                (r >= 7 && r <= 9 && c >= 7 && c <= 9)) { // Center
                continue;
            }

            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.id = `cell-${r}-${c}`;
            board.appendChild(cell);

            // Position cells using grid-area
            cell.style.gridArea = `${r} / ${c} / span 1 / span 1`;

            // Add specific classes for path cells
            if (commonPath.includes(cell.id) || Object.values(homePaths).some(path => path.includes(cell.id))) {
                cell.classList.add('path-cell');
            }

            // Add color classes for specific path segments
            if (cell.id === players.red.startCell) cell.classList.add('red-path', 'start-cell');
            if (cell.id === players.green.startCell) cell.classList.add('green-path', 'start-cell');
            if (cell.id === players.yellow.startCell) cell.classList.add('yellow-path', 'start-cell');
            if (cell.id === players.blue.startCell) cell.classList.add('blue-path', 'start-cell');

            // Add safe cell class
            if (safeCells.includes(cell.id)) {
                cell.classList.add('safe-cell');
            }

            // Add home path colors
            if (homePaths.red.includes(cell.id) && cell.id !== players.red.finishCell) cell.classList.add('red-path');
            if (homePaths.green.includes(cell.id) && cell.id !== players.green.finishCell) cell.classList.add('green-path');
            if (homePaths.yellow.includes(cell.id) && cell.id !== players.yellow.finishCell) cell.classList.add('yellow-path');
            if (homePaths.blue.includes(cell.id) && cell.id !== players.blue.finishCell) cell.classList.add('blue-path');
        }
    }
}


// ===================== ROOM MANAGEMENT =====================

/**
 * Creates a new game room
 */
function createRoom() {
    const name = playerNameInput.value.trim();
    if (!name) {
        // showMessage("Please enter your name");
        toast.warning("Please enter your name",4000);
        return;
    }
    
    playerName = name;
    console.log(`emmitting create-room with playerName: ${playerName}`);   
    socket.emit('create-room', { playerName });
    // showMessage("Creating room...", true);
    toast.info("Creating room...", 2000);
}

/**
 * Joins an existing game room
 */
function joinRoom() {
    const name = playerNameInput.value.trim();
    const roomCode = roomIdInput.value.trim().toUpperCase();
    
    if (!name || !roomCode) {
        // showMessage("Please enter your name and room code");
        toast.warning("Please enter your name and room code", 4000);
        return;
    }
    
    playerName = name;
    // console.log(`emmitting join-room with playerName: ${playerName}, roomCode: ${roomCode}`);

    // console.log(`emitting join-room with code: ${roomCode}`);

    socket.emit('join-room', { roomId: roomCode, playerName: name });
    // showMessage("Joining room...", true);
    // toast.info("Joining room...");
}

/**
 * Starts the game (only host can do this)
 */
function startGame() {
    if (!isHost) {
        // showMessage("Only the host can start the game");
        toast.warning("Only the host can start the game",2000);
        return;
    }
    
    if (playersInRoom.length < 2) {
        // showMessage("Need at least 2 players to start");
        toast.warning("Need at least 2 players to start",2000);
        return;
    }
    // console.log(`emitting start-game with roomId: ${roomId}`);
    
    socket.emit('start-game', {});

    startGameBtn.style.display = "none";

}

/**
 * Updates the players list display
 */
function updatePlayersDisplay() {
    playersListDiv.innerHTML = '';

    playersInRoom.forEach(player => {
        const playerDiv = document.createElement('div');
        // const playerClass = player.isHost ? 'host'
        //                     : player.color === playerColor ? 'you' : '';
        playerDiv.className = `player-tag ${player.color} ${player.color === playerColor ? 'you' : ''}`;

        let playerStatus = '';
        if (player.hasLeft) {
            playerStatus = '<span class="player-left">❌</span>';  //🔌
        }

        playerDiv.innerHTML = `
            <span class="player-name">${player.name}</span>
            ${player.isHost ? '<span class="host-badge">👑</span>' : ''}
            ${playerStatus}
        `;

        playersListDiv.appendChild(playerDiv);
    });
    
    // Show/hide start button based on host status
    if (isHost) {
        startGameBtn.style.display = 'block';
        // startGameBtn.disabled = playersInRoom.length < 2;
    } else {
        startGameBtn.style.display = 'none';
    }
}

// ===================== SOCKET EVENT HANDLERS =====================

// Room created successfully
socket.on('room-created', (data) => {
    console.log(" on room-created:", (data));
    
    roomId = data.roomId;
    playerColor = data.playerColor;
    isHost = data.isHost;
    
    roomIdDisplay.textContent = roomId;
    roomCreationDiv.style.display = 'none';
    gameAreaDiv.style.display = 'flex';
    initializeBoard();

    showNameInHomeArea("You", playerColor);
    
    // showMessage(`Room created! Share code: ${roomId}`);
    toast.success(`Room created! Share code: ${roomId}`,2000);
});

// Successfully joined room
socket.on('room-joined', (data) => {
    console.log("on room-joined:", (data));

    roomId = data.roomId;
    playerColor = data.playerColor;
    isHost = data.isHost;
    playerName = data.playerName;

    roomIdDisplay.textContent = roomId;
    roomCreationDiv.style.display = 'none';
    gameAreaDiv.style.display = 'flex';
    initializeBoard();

   showNameInHomeArea("You", playerColor);
    
    
    showMessage(`Joined room ${roomId} as ${playerColor}`);
    toast.success(`Joined room successfully as ${playerColor}`,1200);
});


function showNameInHomeArea(name, color) {
    const homeArea = document.querySelector(`.home-area.home-${color}`);
    const badgeDiv = homeArea.querySelector('.winner-badge');

    // Check if name is already shown
    const existingName = badgeDiv.querySelector('.playerNameInHomeArea');
    if (existingName) {
        // Optionally update the name if it's different
        if (existingName.textContent !== name) {
            existingName.textContent = name;
        }
        return; // Don't add again
    }

    const nameDiv = document.createElement('div');
    nameDiv.classList.add('playerNameInHomeArea');
    nameDiv.textContent = name;

    badgeDiv.appendChild(nameDiv);
    badgeDiv.style.display = "flex";
}


// Room state updated (player joined/left)
socket.on('room-update', (data) => {
    console.log("on room-update:", (data));
    playersInRoom = data.players;
    updatePlayersDisplay();
    
    // Update your existing playerColorsInGame array
    playerColorsInGame.length = 0; // Clear existing
    playersInRoom.forEach(player => {
        playerColorsInGame.push(player.color);
        
        if (playerName === player.name) return;
        showNameInHomeArea(player.name, player.color);
    });
});

// Game started
socket.on('game-started', (data) => {
    console.log("on game-started:", (data));
    gameState = data.gameState;
    gameStarted = true;
    
    // Hide room management UI, show game
    document.querySelector('.room-management').style.display = 'none';
    document.querySelector('.game-container').style.display = 'flex';
    
    // Initialize game with only the colors of players in room

    // playerColorsInGame = (data.playerColors).map(player => player.color); // Update player colors in game
    initializeOnlineGame(playerColorsInGame);
    // initializeOnlineGame(data.playerColors);
    
    currentTurn = gameState.currentTurn;
    updateCurrentPlayerDisplay();
    
    // showMessage("Game started! Good luck!");
    toast.success("Game started! Good luck!",1200);
});

// Player left the room
socket.on('player-left', (data) => {
    console.log("🧑❌ on player-left:", (data));
    playersInRoom = data.remainingPlayers;
    updatePlayersDisplay();
    // showMessage(`${data.playerName} left the game`);
    toast.error(`${data.playerName} left the game`,3000);

    // Add "left" visual indicator
    showLeftIndicator(data.color);
});


// Add "left" visual indicator
function showLeftIndicator(playerColor) {
    const homeArea = document.querySelector(`.home-area.home-${playerColor}`);
    const playerElement = homeArea.querySelector('.winner-badge');
    if (playerElement && !playerElement.querySelector('.left-icon')) {
        const leftIcon = document.createElement('div');
        leftIcon.classList.add('left-icon');
        leftIcon.textContent = '❌'; // Or use ❌, 🔕, etc.
        playerElement.appendChild(leftIcon);
    }
}



// Game ended
socket.on('game-ended', (data) => {
    console.log("🎮🚫 on game-ended:", (data)); 

    gameStarted = false;
    // showMessage(`Game ended: ${data.reason}`);
    // toast.info(`Game ended: ${data.reason}`);
    if (data.message === "Game finished") {
        showMessage(`Game finished: \n winners: ${data.winners.join(', ')}`);
    }

    if (data.message === "Insufficient players") {
        showMessage(`Game cannot continue: \n ${data.reason}`);
    }

    // Re-enable room management
    // document.querySelector('.room-management').style.display = 'block';
});

// Dice rolled by a player
socket.on('dice-rolled', (data) => {
    console.log("🎲 on dice-rolled:", (data));
    diceValue = data.diceValue;
    
    // Update dice display to show the rolled value
    updateDiceDisplay(data.finalX, data.finalY);

    
    
    if (data.player === playerColor) {
        // This is our roll, handle it
        handleOwnDiceRoll(data.diceValue);
    } else {
        // Another player rolled
        // showMessage(`${data.playerName} rolled ${data.diceValue}`);
        console.log(` ${data.playerName} rolled ${data.diceValue}`);
        
    }
});

// Piece moved by a player
socket.on('piece-moved', async(data) => {
    console.log("🧩 on piece-moved:", (data));
    const { pieceId, newPosition, steps, newPathIndex, player } = data;

    if (player !== playerColor) {
        // Update the piece position for other players
        const piece = document.querySelector(`[data-piece-id="${pieceId}"]`);
        if (piece) {
            // await updatePiecePosition(piece, newPosition, newPathIndex);
            await updatePiecePosition(piece, steps);
        }
    }
});

// Turn changed
socket.on('turn-changed',(data) => {
    console.log("🔄 on turn-changed:", (data));
    currentTurn = data.currentTurn;
    updateCurrentPlayerDisplay(); 

    console.log("🎨 playerColor:", playerColor, "🧑 data.currentPlayer:", data.currentPlayer);
    if (playerColor === currentTurn) {
        // showMessage("It's your turn!");
        toast.info("It's your turn!",400);
        console.log("🎯 It's your turn!");
        
        dice.style.pointerEvents = 'auto';
    } else {
        // showMessage(`It's ${data.currentPlayer}'s turn`);
        console.log(`🕹️ It's ${data.currentPlayer}'s turn`);
        // console.log(`Setting dice pointerEvents to none for ${data.currentPlayer}`);
        
        dice.style.pointerEvents = 'none';
        console.log("🎲❌ dice disabled");
        
    }
});

// Error handling
socket.on('error', (data) => {
    console.error("on error:", (data));
    // showMessage(data.message);
    toast.error(data.message);
});

// ===================== GAME LOGIC MODIFICATIONS =====================

/**
 * Initialize the online game with specific player colors
 */
function initializeOnlineGame(playerColors) {
    // Use your existing initializeBoard() and createPieces() functions
    // but modify them to only create pieces for players in the game
    
    // Clear existing board if any
    // board.innerHTML = '';
    
    // Initialize board (use your existing function)
    // initializeBoard();
    
    // Create pieces only for players in the room
    createOnlinePieces(playerColors);
    
    // Set up initial game state
    onGameStart();
}

/**
 * Create pieces only for players in the online game
 */
function createOnlinePieces(playerColors) {
    // Clear existing pieces
    Object.values(players).forEach(player => player.pieces = []);
    
    playerColors.forEach(color => {
        const player = players[color];
        for (let i = 0; i < 4; i++) {
            const piece = document.createElement('div');
            piece.classList.add('piece', color);
            piece.dataset.player = color;
            piece.dataset.pieceId = `${color}-${i + 1}`;
            piece.dataset.position = 'home';
            piece.dataset.pathIndex = -1;
            piece.textContent = i + 1;

            const homeCircle = document.getElementById(player.homeCircles[i]);
            if (homeCircle) {
                homeCircle.appendChild(piece);
            }
            player.pieces.push(piece);

            // Only add click listener for own pieces
            if (color === playerColor) {
                piece.addEventListener('click', handlePieceClick);
            }
        }
    });
}

/**
 * Modified dice roll function for online play
 */


const FACE_ROTATIONS = {
  1: { x:   0,  y:   0 },  // front
  2: { x:  90,  y:   0 },  // top
  3: { x:   0,  y: 270 },  // right
  4: { x:   0,  y:  90 },  // left
  5: { x: 270,  y:   0 },  // bottom
  6: { x:   0,  y: 180 }   // back
};

let currentX = 0;
let currentY = 0;

// (Optional) you can keep a getDiceValue() that just double-checks,
// but if you never accumulate “illegal” combos, it’ll always match FACE_ROTATIONS.
function getDiceValue(x, y) {
  const nx = ((x % 360) + 360) % 360;
  const ny = ((y % 360) + 360) % 360;

  if (nx === 0 && ny === 0)   return 1; // front
  if (nx === 90 && ny === 0)  return 2; // top
  if (nx === 0 && ny === 270) return 4; // right
  if (nx === 0 && ny === 90)  return 3; // left
  if (nx === 270 && ny === 0) return 5; // bottom
  if (nx === 0 && ny === 180) return 6; // back
  return 1; // fallback
}

let rollingTimeout,nextTimeout = null; // To cancel current animation
let isRolling = false;

async function diceRollAnimation() {    
    if (!gameStarted) return;

    // Check if it's the player's turn
    if (currentTurn !== playerColor) {
        // showMessage("It's not your turn!");
        toast.warning("It's not your turn!",1000);
        return;
    }
    
    if (selectedPiece) {
        // showMessage("Please move your selected piece or deselect it.");
        toast.warning("Please move your selected piece or deselect it.",2000);
        return;
    }
    
    if (isRolling) return;
    
    // Perform dice animation (keep your existing animation code)
    if (rollingTimeout) {
        clearTimeout(rollingTimeout);
        clearTimeout(nextTimeout);
        isRolling = false;
    }

    isRolling = true;

    const faceNum = Math.floor(Math.random() * 6) + 1;
    const { x: baseX, y: baseY } = FACE_ROTATIONS[faceNum];

    const spinX = 360 * (2 + Math.floor(Math.random() * 2));
    const spinY = 360 * (2 + Math.floor(Math.random() * 2));

    const finalX = spinX + baseX;
    const finalY = spinY + baseY;

    dice.style.transition = 'transform 0.7s ease-out';
    dice.style.transform = `rotateX(${finalX}deg) rotateY(${finalY}deg)`;

    restartAudio(diceRollingAudio);
    document.querySelector('.dice-area').classList.add('rolling');
    
    const value = getDiceValue(finalX, finalY);
    currentX = baseX;
    currentY = baseY;    

    socket.emit('roll-dice', { diceValue: value, finalX: finalX, finalY: finalY });
    rollingTimeout = setTimeout(() => {
        diceRollingAudio.pause();
        dice.style.pointerEvents = 'none';
        document.querySelector('.dice-area').classList.remove('rolling');
        // socket.emit('roll-dice', { diceValue: value, finalX: finalX, finalY: finalY });
    }, 600);

    nextTimeout = setTimeout(() => {
        // Send dice roll to server
        console.log(`➡️ emitting roll-dice 🎲 with value: ${value}`);
        
        isRolling = false;
        rollingTimeout = null;
        handleOwnDiceRoll(value);
    }, 900);
}

async function updateDiceDisplay(finalX, finalY) {
    // if (isRolling) return;

    // // Perform dice animation (keep your existing animation code)
    // if (rollingTimeout) {
    //     clearTimeout(rollingTimeout);
    //     clearTimeout(nextTimeout);
    //     isRolling = false;
    // }

    // isRolling = true;
    // console.log(`on dice-rolled with finalX: ${finalX}, finalY: ${finalY}`);
    
    dice.style.transition = 'transform 0.7s ease-out';
    dice.style.transform = `rotateX(${finalX}deg) rotateY(${finalY}deg)`;

    restartAudio(diceRollingAudio);
    document.querySelector('.dice-area').classList.add('rolling');
    
    const value = getDiceValue(finalX, finalY);
    
    setTimeout(() => {
        diceRollingAudio.pause();
        // dice.style.pointerEvents = 'none';
        // console.log(`dice pointerEvents set to none`);
        
        document.querySelector('.dice-area').classList.remove('rolling');        
    }, 600);

    // nextTimeout = setTimeout(() => {
        // Send dice roll to server
        // console.log(`emitting roll-dice with value: ${value}`);
        
        // socket.emit('roll-dice', { value: value });
        // isRolling = false;
        // rollingTimeout = null;
    // }, 900);
}

/**
 * Handle own dice roll result
 */
 function handleOwnDiceRoll(value) {
    diceValue = value;
    
    // Use your existing logic to determine playable pieces
    const currentPlayer = players[currentTurn];
    let playablePieces = [];

    const piecesInHome = currentPlayer.pieces.filter(p => p.dataset.position === 'home');
    if (diceValue === 6 && piecesInHome.length > 0) {
        playablePieces.push(...piecesInHome);
    }
    
    const piecesOnPath = currentPlayer.pieces.filter(p => p.dataset.position.includes('path'));
    const endOfFullPath = fullPaths[currentPlayer.color].length;
    piecesOnPath.forEach(piece => {
        const currentPathIndex = parseInt(piece.dataset.pathIndex);
        if (currentPathIndex !== -1 && (currentPathIndex + diceValue) < endOfFullPath) {
            playablePieces.push(piece);
        }
    });
    
    if (playablePieces.length === 0) {
        console.log(`🔚 emitting end-turn `);

        socket.emit('end-turn', {});
    } else if (playablePieces.length === 1 || 
               (playablePieces.length > 0 && playablePieces.every(p => p.dataset.position === 'home'))) {
        playablePieces[0].classList.add('selected');
        selectedPiece = playablePieces[0];
        movePiece(selectedPiece, diceValue);
        playablePieces[0].classList.remove('selected');
    } else {
        playablePieces.forEach(piece => piece.classList.add('selected'));
    }
}


function handlePieceClick(event) {
    const clickedPiece = event.currentTarget;
    const playerColor = clickedPiece.dataset.player;

    if (playerColor !== currentTurn || diceValue === 0) {
        // showMessage("It's not your turn or you haven't rolled the dice yet.");
        toast.warning("It's not your turn or you haven't rolled the dice yet.",2000);
        return;
    }

    // If a piece is already selected, deselect it
    if (selectedPiece) {
        selectedPiece.classList.remove('selected');
    }

    // Select the clicked piece
    selectedPiece = clickedPiece;
    selectedPiece.classList.add('selected');

    // Attempt to move the piece
    movePiece(selectedPiece, diceValue);
}

/**
 * Modified move piece function for online play
 */
let isEnteredFinishZone = false;
async function movePiece(piece, steps) {
    // Keep your existing move logic but add server communication
    
    const player = players[currentTurn];
    const color = player.color;
    const pathArray = fullPaths[color];
    const finishIndex = pathArray.length - 1;
    const COMMON_LENGTH = 51;

    // Your existing move validation logic here...
    
    if (piece.dataset.position === 'home') {
        if (steps === 6) {
            const startCell = document.getElementById(pathArray[0]);
            if (!startCell) {
                console.error(`Cannot find start cell ${pathArray[0]}`);
                deselectPiece();
                return;
            }
            socket.emit('move-piece', {
                pieceId: piece.dataset.pieceId,
                newPosition: 'path',
                newPathIndex: 0,
                steps
            });
            
            await animatePieceToCell(piece, startCell);
            arrangePiecesInCell(startCell);
            piece.dataset.position = 'path';
            piece.dataset.pathIndex = '0';
            
            // console.log(`➡️ emitting move-piece for ${piece.dataset.pieceId} to path index 0`);
            
            // Send move to server
            // socket.emit('move-piece', {
            //     pieceId: piece.dataset.pieceId,
            //     newPosition: 'path',
            //     newPathIndex: 0,
            //     steps
            // });
            
            resetOnlineTurn();
        } else {
            deselectPiece();
        }
        return;
    }

    // Rest of your existing move logic...
    let currentIndex = parseInt(piece.dataset.pathIndex, 10);
    if (isNaN(currentIndex)) currentIndex = -1;

    let newIndex = currentIndex + steps;

    if (newIndex > finishIndex) {
        // showMessage("Cannot move: Overshot the finish. Try again.");
        toast.warning("Cannot move: Overshot the finish. Try again.",2000);
        return;
    }

    if (newIndex === finishIndex) {
        const finishCell = document.getElementById(pathArray[finishIndex]);
        if (!finishCell) {
            console.error(`Cannot find finish cell ${pathArray[finishIndex]}`);
            deselectPiece();
            return;
        }
        socket.emit('move-piece', {
            pieceId: piece.dataset.pieceId,
            newPosition: 'finished',
            newPathIndex: newIndex,
            steps
        });
        isEnteredFinishZone = true;
        await animatePieceMovementToTargetIndex(piece, pathArray, currentIndex, newIndex);

        piece.dataset.position = 'finished';
        piece.dataset.pathIndex = finishIndex.toString();
        
        // console.log(`emitting move-piece for ${piece.dataset.pieceId} to finished with index ${newIndex}`);
        
        // Send move to server
        // socket.emit('move-piece', {
        //     pieceId: piece.dataset.pieceId,
        //     newPosition: 'finished',
        //     newPathIndex: newIndex,
        //     steps
        // });
        // console.log(`going to check win condition for ${currentTurn}`);
        
        checkWinCondition();

        // console.log(`completed win condition for ${currentTurn}`);
        

        resetOnlineTurn();
        return;
    }

    // Normal move
    const targetCellId = pathArray[newIndex];
    const targetCell = document.getElementById(targetCellId);
    if (!targetCell) {
        console.error(`Cannot find target cell ${targetCellId}`);
        deselectPiece();
        return;
    }

    socket.emit('move-piece', {
        pieceId: piece.dataset.pieceId,
        newPosition: (newIndex < COMMON_LENGTH ? 'path' : 'home-path'),
        newPathIndex: newIndex,
        steps
    });

    await animatePieceMovementToTargetIndex(piece, pathArray, currentIndex, newIndex);
    piece.dataset.position = (newIndex < COMMON_LENGTH ? 'path' : 'home-path');
    piece.dataset.pathIndex = newIndex.toString();

    console.log(`➡️ emitting move-piece for ${piece.dataset.pieceId} to path index ${newIndex}`);

    // Send move to server
    // socket.emit('move-piece', {
    //     pieceId: piece.dataset.pieceId,
    //     newPosition: piece.dataset.position,
    //     newPathIndex: newIndex,
    //     steps
    // });
    
    if (newIndex < COMMON_LENGTH) {
        checkAndKillOpponent(piece);
    }

    resetOnlineTurn();
}


let iskilledOtherPlayer = false; 
async function checkAndKillOpponent(movedPiece) {
    const currentCell = movedPiece.parentNode;
    const movedPiecePlayer = movedPiece.dataset.player;

    // Don't kill if on a safe cell
    if (currentCell.classList.contains('safe-cell')) {
        return;
    }

    const piecesOnCell = Array.from(currentCell.querySelectorAll('.piece'));

    await Promise.all(piecesOnCell.map(async piece => {
        if (piece !== movedPiece && piece.dataset.player !== movedPiecePlayer) {
            // This is an opponent's piece, kill it!
            const opponentPlayer = players[piece.dataset.player];
            const pieceId = piece.dataset.pieceId;
            const pieceNumber = parseInt(pieceId.split('-')[1]);
            iskilledOtherPlayer = true; // Set flag for killed piece

            // Move piece back to its home circle
            const homeCircle = document.getElementById(opponentPlayer.homeCircles[pieceNumber - 1]);
            if (homeCircle) {
                // homeCircle.appendChild(piece);
                await animatePieceToCell(piece, homeCircle, 500);
                piece.dataset.position = 'home';
                piece.dataset.pathIndex = -1;
                piece.style.width = `${pieceSize}px`;
                piece.style.height = `${pieceSize}px`;
                // showMessage(`${movedPiecePlayer.toUpperCase()} killed ${piece.dataset.player.toUpperCase()}'s piece!`);
                toast.info(`${movedPiecePlayer.toUpperCase()} killed ${piece.dataset.player.toUpperCase()}'s piece!`,1400);
            } else {
                console.error(`Home circle for killed piece ${pieceId} not found.`);
            }
        }
    }));

    arrangePiecesInCell(currentCell); // Re-arrange pieces in the current cell
}


function checkWinCondition() {
    console.log(`🏆 winning check for ${currentTurn} `);
    
    const currentPlayer = players[currentTurn];
    const finishedPieces = currentPlayer.pieces.filter(p => p.dataset.position === 'finished');
    // console.log(`pieces : ${currentPlayer.pieces} `);

    if (finishedPieces.length === 1) {
        // showMessage(`${currentTurn.toUpperCase()} wins the game! Congratulations!`);
        toast.success(`${currentTurn.toUpperCase()} wins the game! Congratulations!`, 2000);
       declareWinner(currentTurn); 
       playerColorsInGame.splice(playerColorsInGame.indexOf(currentTurn), 1); 
    }
}



/**
 * Reset turn for online game
 */
function resetOnlineTurn() {
    deselectPiece();
    
    if (!gameStarted) {
        dice.style.pointerEvents = 'none';
        return;
    }
    
    const hasPlayerWon = winners.includes(currentTurn);
    
    // Check if player gets another turn (rolled 6, killed piece, or entered finish)
    if ((diceValue !== 6 && !isEnteredFinishZone && !iskilledOtherPlayer) || hasPlayerWon) {
        // End turn
        console.log(`🔚 emitting end-turn for ${currentTurn}`);
        
        socket.emit('end-turn', {hasPlayerWon});
        resetSpecialFlags();
    } else {
        // Player gets another turn
        dice.style.pointerEvents = 'auto';
        // showMessage("You get another turn!");
        toast.info("You get another turn!",700);
    }
    
    diceValue = 0;
    resetSpecialFlags();
}

/**
 * Update piece position for other players' moves
 */


async function updatePiecePosition(piece, steps) {
    // Keep your existing move logic but add server communication
    
    // const player = players[currentTurn];
    const color = piece.dataset.player;
    const pathArray = fullPaths[color];
    const finishIndex = pathArray.length - 1;
    const COMMON_LENGTH = 51;

    // Your existing move validation logic here...
    
    if (piece.dataset.position === 'home') {
        if (steps === 6) {
            const startCell = document.getElementById(pathArray[0]);
            if (!startCell) {
                console.error(`Cannot find start cell ${pathArray[0]}`);
                deselectPiece();
                return;
            }
            
            await animatePieceToCell(piece, startCell);
            arrangePiecesInCell(startCell);
            piece.dataset.position = 'path';
            piece.dataset.pathIndex = '0';
            
                                   
            // resetOnlineTurn();
        } else {
            deselectPiece();
        }
        return;
    }

    // Rest of your existing move logic...
    let currentIndex = parseInt(piece.dataset.pathIndex, 10);
    if (isNaN(currentIndex)) currentIndex = -1;

    let newIndex = currentIndex + steps;

    if (newIndex > finishIndex) {
        // showMessage("Cannot move: Overshot the finish. Try again.");
        toast.warning("Cannot move: Overshot the finish. Try again.",3000);
        return;
    }
    console.log(` moving piece 🧩 ${piece.dataset.pieceId} from index ${currentIndex} to new index ${newIndex}`);
    
    if (newIndex === finishIndex) {
        const finishCell = document.getElementById(pathArray[finishIndex]);
        if (!finishCell) {
            console.error(`Cannot find finish cell ${pathArray[finishIndex]}`);
            deselectPiece();
            return;
        }
        
        isEnteredFinishZone = true;
        await animatePieceMovementToTargetIndex(piece, pathArray, currentIndex, newIndex);

        piece.dataset.position = 'finished';
        piece.dataset.pathIndex = finishIndex.toString();
        
                
        checkWinCondition();
        // resetOnlineTurn();
        return;
    }

    // Normal move
    const targetCellId = pathArray[newIndex];
    const targetCell = document.getElementById(targetCellId);
    if (!targetCell) {
        console.error(`Cannot find target cell ${targetCellId}`);
        deselectPiece();
        return;
    }

    await animatePieceMovementToTargetIndex(piece, pathArray, currentIndex, newIndex);
    piece.dataset.position = (newIndex < COMMON_LENGTH ? 'path' : 'home-path');
    piece.dataset.pathIndex = newIndex.toString();
    
       
    if (newIndex < COMMON_LENGTH) {
        checkAndKillOpponent(piece);
    }

    if (currentTurn === playerColor) {
        dice.style.pointerEvents = 'auto';
        console.log("🎲✅ dice enabled");      
    }

    // resetOnlineTurn();
}


/**
 * Update current player display
 */
function updateCurrentPlayerDisplay() {
    currentPlayerDisplay.textContent = currentTurn;
    currentPlayerDisplay.className = '';
    currentPlayerDisplay.classList.add(`${currentTurn}-turn`);
    startHeartbeat(currentTurn);
    changeDiceColor(currentTurn);
}


 
 function onGameStart() {
     setTimeout(() => {
         const piece = document.querySelector('.piece');
         pieceSize = roundoff(getComputedStyle(piece).width); // e.g., "26px"
            
    }, 3000);
 }

/**
 * Reset special flags
 */
function resetSpecialFlags() {
    isEnteredFinishZone = false;
    iskilledOtherPlayer = false;
}

function deselectPiece() {
    if (selectedPiece) {
        selectedPiece.classList.remove('selected');
        selectedPiece = null;
    }
    // Remove highlighting from all pieces
    document.querySelectorAll('.piece.selected').forEach(p => p.classList.remove('selected'));
}



// Array to keep track of winners in order
const winners = [];

// Call this function when a player wins
function declareWinner(playerColor) {
    if (winners.includes(playerColor)) return; // Prevent duplicate

    winners.push(playerColor);

    let place = winners.length; // 1st, 2nd, 3rd, etc.
    place = place === 1 ? "1st" : place === 2 ? "2nd" : "3rd";
    const badgeImageSrc = `./media/${place}.png`;
    console.log(`🏆 declaring winner: ${playerColor} in ${place} place`);

    const homeArea = document.querySelector(`.home-area.home-${playerColor}`);
    const badgeDiv = homeArea.querySelector('.winner-badge');
    const img = document.createElement('img');

    img.src = badgeImageSrc;
    img.alt = `${place} Place`;
    img.style.display = 'block';
    badgeDiv.appendChild(img);

    // if (winners.length === playerColorsInGame.length || currentTurn === "yellow") {
    if (winners.length === 3) {
        // If 3 players have finished or it's a human player finished
        gameEnds(); // All players have finished
        return;
    }
}


function gameEnds() {
    // Disable all interactions
    dice.style.pointerEvents = 'none';
    document.querySelectorAll('.piece').forEach(piece => {
        piece.removeEventListener('click', handlePieceClick);
    });
    gameStarted = false;
    playerColorsInGame.splice(0, playerColorsInGame.length); // Clear player colors in game
    // showMessage("Game Over! Thanks for playing!");
    toast.info("Game Ends! Thanks for playing!",4000);
}


function copyRoomId() {
    const roomIdSpan = document.getElementById("room-id-display");
    const textToCopy = roomIdSpan.textContent;

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast.success("Room ID copied to clipboard!",1200);
      })
      .catch(err => {
        console.error("Failed to copy:", err);
        toast.error("Failed to copy Room ID.",3000);
      });
}


// ===================== EVENT LISTENERS =====================

// Room management buttons
document.getElementById('create-room-btn').addEventListener('click', createRoom);
document.getElementById('join-room-btn').addEventListener('click', joinRoom);
startGameBtn.addEventListener('click', startGame);

// Modified dice click handler
dice.addEventListener('click', diceRollAnimation);

document.getElementById("room-id-display").addEventListener("click", copyRoomId);

// ===================== INITIALIZATION =====================

// Initialize the page
window.onload = function() {
    // Show room creation/joining interface
    roomCreationDiv.style.display = 'flex';
    gameAreaDiv.style.display = 'none';
    
    // Initialize board structure but don't start game yet
    // The game will be initialized when 'game-started' event is received
};

// Handle page refresh/close
window.addEventListener('beforeunload', () => {
    if (socket.connected) {
        console.log("Disconnecting socket before unload");
        socket.disconnect();
    }
});





// Export functions that might be needed elsewhere
export { playerColor, roomId, socket,pieceSize, diceValue,fullPaths,players };