// import { pieceSize } from './human.js';
import { pieceSize } from "./online_ludo.js";

const dice = document.getElementById("dice");

async function animatePieceToCell(piece, targetCell, duration = 200) {
  dice.style.pointerEvents = "none";
  console.log("dice disabled");
  //   const startCell = piece.parentElement;
  const pieceRect = piece.getBoundingClientRect();
  const targetRect = targetCell.getBoundingClientRect();

  const dx = targetRect.left - pieceRect.left;
  const dy = targetRect.top - pieceRect.top;

  // Set position absolute (if not already)
  piece.style.position = "absolute";
  piece.style.pointerEvents = "none"; // Prevent click during animation
  piece.style.zIndex = 1000;
  piece.style.transition = `transform ${duration}ms ease`;

  piece.style.transform = `translate(${dx}px, ${dy}px)`;

  await new Promise((resolve) => setTimeout(resolve, duration));

  // Reset transform and move DOM element
  piece.style.transition = "none";
  piece.style.transform = "none";
  piece.style.pointerEvents = "";
  piece.style.zIndex = "";

  targetCell.appendChild(piece);
  //   piece.style.position = 'relative';
  piece.style.left = "unset";
  piece.style.top = "unset";
}

function arrangePiecesInCell(cell) {
  console.log(`Arranging pieces in cell:`, cell);

  const pieces = cell.querySelectorAll(".piece"); // Make sure each piece has class="piece"
  const total = pieces.length;
  const radius = 8; // You can tweak this to control spacing

  if (total === 1) {
    pieces[0].style.left = "unset";
    pieces[0].style.top = "unset";
    pieces[0].style.transform = "none";
    pieces[0].style.width = `${pieceSize}px`;
    pieces[0].style.height = `${pieceSize}px`;
    pieces[0].style.zIndex = 2;
    return;
  }

  let zIndex = 2;
  pieces.forEach((p, index) => {
    const angle = (index / total) * (2 * Math.PI);
    const offsetX = Math.cos(angle) * radius;
    const offsetY = Math.sin(angle) * radius;

    p.style.position = "absolute";
    p.style.width = "20px";
    p.style.height = "20px";
    p.style.left = `calc(50% + ${offsetX}px)`;
    p.style.top = `calc(50% + ${offsetY}px)`;
    p.style.transform = "translate(-50%, -50%)"; // Center the piece
    p.style.zIndex = zIndex++;
  });
}

async function animatePieceMovementToTargetIndex(
  piece,
  pathArray,
  fromIndex,
  toIndex
) {
  console.log(
    `Animating piece ${piece} from index ${fromIndex} to ${toIndex} on path:`
  );

  const startCell = document.getElementById(pathArray[fromIndex]);
  const targetCell = document.getElementById(pathArray[toIndex]);
  dice.style.pointerEvents = "none";
  console.log("dice disabled");

  for (let i = fromIndex + 1; i <= toIndex; i++) {
    const cellId = pathArray[i];
    const cell = document.getElementById(cellId);
    if (!cell) {
      console.error(`Cell ${cellId} not found during animation.`);
      showMessage("Error: Path animation failed.");
      return;
    }

    await animatePieceToCell(piece, cell); // Animate to next step
  }

  console.log("startCell", startCell, "targetCell", targetCell);

  arrangePiecesInCell(startCell);
  arrangePiecesInCell(targetCell);
}

function restartAudio(audio, fromTime = 0) {
  audio.pause();
  audio.currentTime = fromTime;
  return audio.play(); // returns a Promise you can await if needed
}

const homeRed = document.getElementsByClassName("home-red"); // Assuming this is the red home element
const homeBlue = document.getElementsByClassName("home-blue"); // Assuming this is the blue home element
const homeGreen = document.getElementsByClassName("home-green"); // Assuming this is the green home element
const homeYellow = document.getElementsByClassName("home-yellow"); // Assuming this is the yellow home element

// To start the heartbeat
function startHeartbeat(color) {
  homeBlue[0].classList.remove("heartbeat");
  homeGreen[0].classList.remove("heartbeat");
  homeYellow[0].classList.remove("heartbeat");
  homeRed[0].classList.remove("heartbeat");

  if (color === "blue") {
    homeBlue[0].classList.add("heartbeat");
  } else if (color === "green") {
    homeGreen[0].classList.add("heartbeat");
  } else if (color === "yellow") {
    homeYellow[0].classList.add("heartbeat");
  } else if (color === "red") {
    homeRed[0].classList.add("heartbeat"); // Remove heartbeat from others
  }
}

// To stop the heartbeat
function stopHeartbeat(color) {
  if (color === "blue") {
    homeBlue[0].classList.remove("heartbeat");
  } else if (color === "green") {
    homeGreen[0].classList.remove("heartbeat");
  } else if (color === "yellow") {
    homeYellow[0].classList.remove("heartbeat");
  } else if (color === "red") {
    homeRed[0].classList.remove("heartbeat");
  }
}

const diceFaces = document.getElementsByClassName("face"); // Assuming dice faces have this class
function changeDiceColor(color) {
  for (let i = 0; i < diceFaces.length; i++) {
    diceFaces[i].classList.remove("red", "green", "yellow", "blue");
    diceFaces[i].classList.add(color);
  }
}

function roundoff(size) {
  return Math.round(parseFloat(size));
}

export {
  animatePieceToCell,
  arrangePiecesInCell,
  animatePieceMovementToTargetIndex,
  restartAudio,
  startHeartbeat,
  stopHeartbeat,
  changeDiceColor,
  roundoff,
};
