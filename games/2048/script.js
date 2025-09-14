const boardSize = 4;
const tilesLayer = document.getElementById("tilesLayer");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const boardWrap = document.getElementById("boardWrap");

let board = [];
let score = 0;
let bestScore = localStorage.getItem("bestScore") || 0;

bestEl.textContent = bestScore;

const gap = 15;
const tileSize = (boardWrap.clientWidth - gap * (boardSize - 1) - 40) / boardSize;

function initBoard() {
  board = Array(boardSize).fill().map(() => Array(boardSize).fill(0));
  score = 0;
  tilesLayer.innerHTML = "";
  document.getElementById("winOverlay").classList.remove("show");
  document.getElementById("gameOverOverlay").classList.remove("show");
  addRandomTile();
  addRandomTile();
  updateBoard();
}

function addRandomTile() {
  let empty = [];
  for (let r = 0; r < boardSize; r++)
    for (let c = 0; c < boardSize; c++)
      if (board[r][c] === 0) empty.push({ r, c });

  if (!empty.length) return;
  let { r, c } = empty[Math.floor(Math.random() * empty.length)];
  board[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function getTileColor(value) {
  return {
    2: "#eee4da", 4: "#ede0c8", 8: "#f3b27a", 16: "#f69664",
    32: "#f77c5f", 64: "#f75f3b", 128: "#edd073", 256: "#edcc63",
    512: "#edc854", 1024: "#edc53f", 2048: "#edc22e"
  }[value] || "#3c3a32";
}

function getTilePosition(r, c) {
  return { top: r * (tileSize + gap), left: c * (tileSize + gap) };
}

function updateBoard() {
  tilesLayer.innerHTML = "";
  let won = false;

  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (board[r][c] !== 0) {
        const tile = document.createElement("div");
        tile.classList.add("tile", "new");
        tile.textContent = board[r][c];
        tile.style.background = getTileColor(board[r][c]);
        const pos = getTilePosition(r, c);
        tile.style.top = pos.top + "px";
        tile.style.left = pos.left + "px";
        tile.style.width = tileSize + "px";
        tile.style.height = tileSize + "px";
        tilesLayer.appendChild(tile);

        if (board[r][c] === 2048) won = true;
      }
    }
  }

  scoreEl.textContent = score;
  bestEl.textContent = Math.max(score, bestScore);
  if (score > bestScore) localStorage.setItem("bestScore", score);

  if (won) document.getElementById("winOverlay").classList.add("show");
}

function checkGameOver() {
  let gameOver = true;
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (board[r][c] === 0) gameOver = false;
      if (r < boardSize-1 && board[r][c] === board[r+1][c]) gameOver = false;
      if (c < boardSize-1 && board[r][c] === board[r][c+1]) gameOver = false;
    }
  }
  if (gameOver) document.getElementById("gameOverOverlay").classList.add("show");
}

function move(direction) {
  let moved = false;
  let merged = Array(boardSize).fill().map(() => Array(boardSize).fill(false));

  function slide(r, c, dr, dc) {
    if (board[r][c] === 0) return;
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
      if (board[nr][nc] === 0) {
        board[nr][nc] = board[r][c]; board[r][c] = 0;
        r = nr; c = nc; nr += dr; nc += dc; moved = true;
      } else if (board[nr][nc] === board[r][c] && !merged[nr][nc]) {
        board[nr][nc] *= 2; board[r][c] = 0;
        score += board[nr][nc]; merged[nr][nc] = true; moved = true;
      } else break;
    }
  }

  if (direction === 'up') for (let c = 0; c < boardSize; c++) for (let r = 1; r < boardSize; r++) slide(r, c, -1, 0);
  if (direction === 'down') for (let c = 0; c < boardSize; c++) for (let r = boardSize-2; r >=0; r--) slide(r, c, 1, 0);
  if (direction === 'left') for (let r = 0; r < boardSize; r++) for (let c = 1; c < boardSize; c++) slide(r, c, 0, -1);
  if (direction === 'right') for (let r = 0; r < boardSize; r++) for (let c = boardSize-2; c >=0; c--) slide(r, c, 0, 1);

  return moved;
}

document.addEventListener("keydown", e => {
  let moved = false;
  switch (e.key) {
    case "ArrowUp": case "w": moved = move('up'); break;
    case "ArrowDown": case "s": moved = move('down'); break;
    case "ArrowLeft": case "a": moved = move('left'); break;
    case "ArrowRight": case "d": moved = move('right'); break;
  }
  if (moved) {
    addRandomTile();
    updateBoard();
    checkGameOver();
  }
});

// Buttons
document.getElementById("newGameBtn").addEventListener("click", initBoard);
document.getElementById("restartBtn").addEventListener("click", initBoard);
document.getElementById("restartFromWin").addEventListener("click", initBoard);
document.getElementById("continueBtn").addEventListener("click", () => {
  document.getElementById("winOverlay").classList.remove("show");
});

initBoard();
