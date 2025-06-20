
let turnTimer = null;
let autoPlayTimer = null;
let timeLeft = 7;
let isAutoPlay = false;


function startTurnTimer() {
    if (currentTurn !== playerColor || !gameStarted) return;
    
    timeLeft = 7;
    isAutoPlay = false;
    showTimer();
    
    turnTimer = setInterval(() => {
        timeLeft--;
        updateTimer();
        
        if (timeLeft <= 0) {
            clearInterval(turnTimer);
            autoPlayTurn();
        }
    }, 1000);
}

function showTimer() {
    const homeArea = document.querySelector(`.home-${currentTurn}`);
    const timerContainer = homeArea.querySelector('.timer-container');
    timerContainer.style.display = 'block';
    updateTimer();
}

function hideTimer() {
    document.querySelectorAll('.timer-container').forEach(timer => {
        timer.style.display = 'none';
    });
}

function updateTimer() {
    const homeArea = document.querySelector(`.home-${currentTurn}`);
    const timerCircle = homeArea.querySelector('.timer-circle');
    const timerProgress = homeArea.querySelector('.timer-progress');
    
    timerCircle.textContent = timeLeft;
    
    const percentage = ((7 - timeLeft) / 7) * 360;
    timerProgress.style.background = `conic-gradient(#ff4757 ${percentage}deg, transparent ${percentage}deg)`;
}

function stopTurnTimer() {
    if (turnTimer) {
        clearInterval(turnTimer);
        turnTimer = null;
    }
    if (autoPlayTimer) {
        clearTimeout(autoPlayTimer);
        autoPlayTimer = null;
    }
    hideTimer();
}

function autoPlayTurn() {
    isAutoPlay = true;
    
    // Disable piece clicking
    document.querySelectorAll('.home-circle.selected').forEach(piece => {
        piece.style.pointerEvents = 'none';
    });
    
    // Auto roll dice
    diceRollAnimation();
    
    // Auto move piece after 2 seconds
    // autoPlayTimer = setTimeout(() => {
    //     autoMoveRandomPiece();
    // }, 2000);
}

function autoMoveRandomPiece() {
    const selectedPieces = document.querySelectorAll('.selected');
    if (selectedPieces.length > 0) {
        const randomPiece = selectedPieces[Math.floor(Math.random() * selectedPieces.length)];
        
        // Deselect all pieces first
        selectedPieces.forEach(piece => {
            piece.classList.remove('selected');
            piece.style.pointerEvents = 'auto';
        });
        
        // Select and move the random piece
        selectedPiece = randomPiece;
        randomPiece.classList.add('selected');
        movePiece(selectedPiece, diceValue);
        randomPiece.classList.remove('selected');
    }
    
    isAutoPlay = false;
}