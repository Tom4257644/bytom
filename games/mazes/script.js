/* Maze Dash - popup.js (rewritten with iframe-safe keyboard handling)
   - Fixes: canvas is focusable & focused; Arrow keys call preventDefault() with a non-passive listener.
   - Everything else preserved: maze gen (randomized DFS), far-apart start/end, timer, storage, colorblind mode, audio beeps.
*/

// ---------- Utilities ----------
const DIFFICULTIES = {
    easy: { rows: 15, cols: 15 },
    medium: { rows: 25, cols: 25 },
    hard: { rows: 35, cols: 35 },
};

const UI = {
    canvas: document.getElementById('mazeCanvas'),
    timer: document.getElementById('timer'),
    best: document.getElementById('best'),
    newBtn: document.getElementById('newMazeBtn'),
    difficulty: document.getElementById('difficulty'),
    winModal: document.getElementById('winModal'),
    winStats: document.getElementById('winStats'),
    modalNew: document.getElementById('modalNew'),
    modalChange: document.getElementById('modalChange'),
    colorblind: document.getElementById('colorblind'),
    mute: document.getElementById('mute'),
};

const ctx = UI.canvas.getContext('2d', { alpha: false });

// Simple seeded RNG (Mulberry32) for deterministic carving per session
function mulberry32(seed) {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

// Audio (optional, synthesized with WebAudio to avoid external assets)
const audio = {
    ctx: null,
    muted: false,
    beep(freq = 440, dur = 0.05, type = 'square', vol = 0.03) {
        if (audio.muted) return;
        if (!audio.ctx) audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = audio.ctx.createOscillator();
        const g = audio.ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.value = vol;
        o.connect(g); g.connect(audio.ctx.destination);
        o.start();
        o.stop(audio.ctx.currentTime + dur);
    },
    win() {
        audio.beep(600, 0.08, 'triangle', 0.04);
        setTimeout(() => audio.beep(800, 0.12, 'triangle', 0.05), 90);
        setTimeout(() => audio.beep(1000, 0.18, 'triangle', 0.06), 200);
    }
};

// Colors
const COLORS = {
    wall: '#d9e2ff',
    path: '#0a0e14',
    player: '#4CC9F0',
    goal: '#FFD166',
    grid: '#2b3340',
    text: '#e8f0fe'
};
const COLORS_CB = {
    wall: '#ffffff',
    path: '#000000',
    player: '#ffff00',
    goal: '#00ffff',
    grid: '#5a5a5a',
    text: '#ffffff'
};

// ---------- Maze Representation ----------
class Cell {
    constructor(r, c) {
        this.r = r; this.c = c;
        this.walls = [true, true, true, true]; // top, right, bottom, left
        this.visited = false;
    }
}

function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Generate perfect maze using randomized DFS (iterative)
function generateMaze(rows, cols, rng) {
    const grid = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => new Cell(r, c)));
    const stack = [];
    const startR = Math.floor(rng() * rows);
    const startC = Math.floor(rng() * cols);
    const start = grid[startR][startC];
    start.visited = true;
    stack.push(start);

    const deltas = [[-1, 0], [0, 1], [1, 0], [0, -1]];

    while (stack.length) {
        const current = stack[stack.length - 1];
        const neighbors = [];
        for (let d = 0; d < 4; d++) {
            const nr = current.r + deltas[d][0];
            const nc = current.c + deltas[d][1];
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !grid[nr][nc].visited) {
                neighbors.push({ dir: d, cell: grid[nr][nc] });
            }
        }
        if (neighbors.length) {
            shuffle(neighbors, rng);
            const pick = neighbors[0];
            current.walls[pick.dir] = false;
            const opposite = (pick.dir + 2) % 4;
            pick.cell.walls[opposite] = false;
            pick.cell.visited = true;
            stack.push(pick.cell);
        } else {
            stack.pop();
        }
    }

    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r][c].visited = false;
    return grid;
}

// BFS distances from a cell; returns { dist, maxDist, farthestCells }
function bfsDistances(grid, start) {
    const rows = grid.length, cols = grid[0].length;
    const dist = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
    const q = [];
    dist[start.r][start.c] = 0;
    q.push(start);
    const deltas = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    let maxDist = 0;
    const farthestCells = [];
    while (q.length) {
        const cur = q.shift();
        const cd = dist[cur.r][cur.c];
        if (cd > maxDist) maxDist = cd;
        for (let d = 0; d < 4; d++) {
            if (!grid[cur.r][cur.c].walls[d]) {
                const nr = cur.r + deltas[d][0];
                const nc = cur.c + deltas[d][1];
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && dist[nr][nc] === Infinity) {
                    dist[nr][nc] = cd + 1;
                    q.push(grid[nr][nc]);
                }
            }
        }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (dist[r][c] === maxDist) farthestCells.push(grid[r][c]);
    return { dist, maxDist, farthestCells };
}

// Pick random start/end far apart (>=60% manhattan max), non-adjacent, reachable
function pickStartEnd(grid, rng) {
    const rows = grid.length, cols = grid[0].length;
    const manhattanMax = (rows - 1) + (cols - 1);
    const minRequired = Math.floor(0.6 * manhattanMax);

    for (let attempt = 0; attempt < 200; attempt++) {
        const sr = Math.floor(rng() * rows), sc = Math.floor(rng() * cols);
        const start = grid[sr][sc];

        const { dist } = bfsDistances(grid, start);

        const pool = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const md = Math.abs(r - sr) + Math.abs(c - sc);
                if (md >= minRequired && md !== 1 && dist[r][c] !== Infinity) pool.push(grid[r][c]);
            }
        }
        if (pool.length) {
            const end = pool[Math.floor(rng() * pool.length)];
            if (solveExists(grid, start, end)) return { start, end };
        }
    }
    // Fallback to farthest-by-distance
    const sr = Math.floor(rng() * rows), sc = Math.floor(rng() * cols);
    const start = grid[sr][sc];
    const { dist } = bfsDistances(grid, start);
    let er = 0, ec = 0, best = -1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (dist[r][c] > best) { best = dist[r][c]; er = r; ec = c; }
    return { start, end: grid[er][ec] };
}

// Verify path (BFS)
function solveExists(grid, start, end) {
    const rows = grid.length, cols = grid[0].length;
    const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
    const q = [start];
    const deltas = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    seen[start.r][start.c] = true;
    while (q.length) {
        const cur = q.shift();
        if (cur === end) return true;
        for (let d = 0; d < 4; d++) {
            if (!grid[cur.r][cur.c].walls[d]) {
                const nr = cur.r + deltas[d][0];
                const nc = cur.c + deltas[d][1];
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !seen[nr][nc]) {
                    seen[nr][nc] = true;
                    q.push(grid[nr][nc]);
                }
            }
        }
    }
    return false;
}

// ---------- Game State ----------
let state = {
    difficulty: 'medium',
    rng: mulberry32(Math.floor(Math.random() * 1e9)),
    grid: null,
    start: null,
    end: null,
    player: null,
    running: false,
    startTime: 0,
    elapsedBeforePause: 0,
    timerId: null,
    colorblind: false,
    bestTimes: { easy: null, medium: null, hard: null },
    muted: false,
    keyDownLock: false, // debounce: one move per keydown
};

// ---------- Rendering ----------
function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const rows = state.grid.length;
    const cols = state.grid[0].length;
    const cW = UI.canvas.width;
    const cH = UI.canvas.height;
    ctx.fillStyle = (state.colorblind ? COLORS_CB.path : COLORS.path);
    ctx.fillRect(0, 0, cW, cH);

    const cellW = Math.min(
        Math.floor((cW - 2) / cols),
        Math.floor((cH - 2) / rows)
    );
    const offX = Math.floor((cW - cols * cellW) / 2);
    const offY = Math.floor((cH - rows * cellW) / 2);

    const wallColor = (state.colorblind ? COLORS_CB.wall : COLORS.wall);
    const gridColor = (state.colorblind ? COLORS_CB.grid : COLORS.grid);
    ctx.strokeStyle = wallColor;
    ctx.lineWidth = 3;

    // subtle grid
    ctx.strokeStyle = gridColor;
    ctx.beginPath();
    for (let r = 0; r <= rows; r++) { ctx.moveTo(offX, offY + r * cellW); ctx.lineTo(offX + cols * cellW, offY + r * cellW); }
    for (let c = 0; c <= cols; c++) { ctx.moveTo(offX + c * cellW, offY); ctx.lineTo(offX + c * cellW, offY + rows * cellW); }
    ctx.stroke();

    // walls
    ctx.strokeStyle = wallColor;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = state.grid[r][c];
            const x = offX + c * cellW;
            const y = offY + r * cellW;
            ctx.beginPath();
            if (cell.walls[0]) { ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x + cellW - 0.5, y + 0.5); }
            if (cell.walls[1]) { ctx.moveTo(x + cellW - 0.5, y + 0.5); ctx.lineTo(x + cellW - 0.5, y + cellW - 0.5); }
            if (cell.walls[2]) { ctx.moveTo(x + 0.5, y + cellW - 0.5); ctx.lineTo(x + cellW - 0.5, y + cellW - 0.5); }
            if (cell.walls[3]) { ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x + 0.5, y + cellW - 0.5); }
            ctx.stroke();
        }
    }
    // outer border
    ctx.beginPath();
    ctx.rect(offX + 0.5, offY + 0.5, cols * cellW - 1, rows * cellW - 1);
    ctx.stroke();

    // goal (diamond)
    const goalColor = (state.colorblind ? COLORS_CB.goal : COLORS.goal);
    const gx = offX + state.end.c * cellW + cellW / 2;
    const gy = offY + state.end.r * cellW + cellW / 2;
    const gr = Math.max(5, Math.floor(cellW * 0.28));
    ctx.fillStyle = goalColor;
    ctx.beginPath();
    ctx.moveTo(gx, gy - gr);
    ctx.lineTo(gx + gr, gy);
    ctx.lineTo(gx, gy + gr);
    ctx.lineTo(gx - gr, gy);
    ctx.closePath();
    ctx.fill();

    // player (circle)
    const playerColor = (state.colorblind ? COLORS_CB.player : COLORS.player);
    const px = offX + state.player.c * cellW + cellW / 2;
    const py = offY + state.player.r * cellW + cellW / 2;
    ctx.beginPath();
    ctx.fillStyle = playerColor;
    ctx.arc(px, py, Math.max(5, Math.floor(cellW * 0.30)), 0, Math.PI * 2);
    ctx.fill();
}

// ---------- Input & Movement ----------
function handleInput(code) {
    const moveMap = {
        'ArrowUp': 0, 'KeyW': 0,
        'ArrowRight': 1, 'KeyD': 1,
        'ArrowDown': 2, 'KeyS': 2,
        'ArrowLeft': 3, 'KeyA': 3,
    };
    const dir = moveMap[code];
    if (dir === undefined) return;
    const p = state.player;
    const cell = state.grid[p.r][p.c];
    if (cell.walls[dir]) return;

    if (!state.running && state.timerId === null) startTimer();

    const deltas = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    p.r += deltas[dir][0];
    p.c += deltas[dir][1];
    audio.beep(520, 0.02, 'square', 0.02);
    draw();

    if (p.r === state.end.r && p.c === state.end.c) stopTimer(true);
}

// ---------- Timer ----------
function formatTime(ms) {
    const totalCs = Math.floor(ms / 10);
    const cs = totalCs % 100;
    const totalS = Math.floor(totalCs / 100);
    const s = totalS % 60;
    const m = Math.floor(totalS / 60);
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    return `${pad(m)}:${pad(s)}.${pad(cs)}`;
}
function updateTimerDisplay() {
    const ms = state.elapsedBeforePause + (state.running ? (performance.now() - state.startTime) : 0);
    UI.timer.textContent = formatTime(ms);
}
function startTimer() {
    state.running = true;
    state.startTime = performance.now();
    if (state.timerId) cancelAnimationFrame(state.timerId);
    const tick = () => {
        updateTimerDisplay();
        state.timerId = requestAnimationFrame(tick);
    };
    state.timerId = requestAnimationFrame(tick);
}
function pauseTimer() {
    if (!state.running) return;
    state.elapsedBeforePause += performance.now() - state.startTime;
    state.running = false;
    if (state.timerId) { cancelAnimationFrame(state.timerId); state.timerId = null; }
    updateTimerDisplay();
}
function resumeTimer() {
    if (state.running) return;
    state.startTime = performance.now();
    state.running = true;
    const tick = () => {
        updateTimerDisplay();
        state.timerId = requestAnimationFrame(tick);
    };
    state.timerId = requestAnimationFrame(tick);
}
function stopTimer(won = false) {
    if (state.timerId) { cancelAnimationFrame(state.timerId); state.timerId = null; }
    const total = state.elapsedBeforePause + (state.running ? (performance.now() - state.startTime) : 0);
    state.running = false;
    state.elapsedBeforePause = total;
    updateTimerDisplay();
    if (won) {
        audio.win();
        maybeSaveBestTime(total);
        showWinModal(total);
    }
}

// ---------- Storage ----------
function saveBestTime(ms) {
    const key = `best_${state.difficulty}`;
    return new Promise(resolve => {
        chrome.storage.local.set({ [key]: ms }, () => resolve());
    });
}
async function maybeSaveBestTime(ms) {
    const key = `best_${state.difficulty}`;
    const existing = await new Promise(resolve => chrome.storage.local.get([key], r => resolve(r[key] ?? null)));
    if (existing === null || ms < existing) {
        await saveBestTime(ms);
        UI.best.textContent = formatTime(ms);
    }
}

async function loadBestTimesAndPrefs() {
    const keys = ['best_easy', 'best_medium', 'best_hard', 'colorblind', 'muted', 'difficulty'];
    const res = await new Promise(resolve => chrome.storage.local.get(keys, resolve));
    state.bestTimes.easy = res.best_easy ?? null;
    state.bestTimes.medium = res.best_medium ?? null;
    state.bestTimes.hard = res.best_hard ?? null;
    state.colorblind = !!res.colorblind;
    state.muted = !!res.muted;
    audio.muted = state.muted;
    if (res.difficulty && DIFFICULTIES[res.difficulty]) {
        state.difficulty = res.difficulty;
        UI.difficulty.value = res.difficulty;
    }
    UI.colorblind.checked = state.colorblind;
    UI.mute.checked = state.muted;
    updateBestLabel();
}

function updateBestLabel() {
    const best = state.bestTimes[state.difficulty];
    UI.best.textContent = best != null ? formatTime(best) : '';
}

// ---------- Modal ----------
function showWinModal(ms) {
    const best = state.bestTimes[state.difficulty];
    const bestTxt = best != null ? formatTime(best) : formatTime(ms);
    UI.winStats.textContent = `Your time: ${formatTime(ms)} · Best (${state.difficulty}): ${bestTxt}`;
    UI.winModal.classList.remove('hidden');
}
function hideWinModal() {
    UI.winModal.classList.add('hidden');
}

// ---------- Game Setup & Regeneration ----------
function reseedRng() {
    state.rng = mulberry32(Math.floor(Math.random() * 1e9));
}
function resetTimerDisplay() {
    state.running = false; state.elapsedBeforePause = 0;
    if (state.timerId) { cancelAnimationFrame(state.timerId); state.timerId = null; }
    UI.timer.textContent = '00:00.00';
}

function regenerate() {
    const { rows, cols } = DIFFICULTIES[state.difficulty];
    reseedRng();
    state.grid = generateMaze(rows, cols, state.rng);
    const { start, end } = pickStartEnd(state.grid, state.rng);
    state.start = start;
    state.end = end;
    state.player = { r: start.r, c: start.c };
    resetTimerDisplay();
    updateBestLabel();
    draw();
}

// ---------- Keyboard Handling (iframe-safe) ----------
const BLOCK_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

// Make canvas focusable and keep focus during play
UI.canvas.tabIndex = 0;

// Prevent page scroll on Arrow keys; route input to game
window.addEventListener('keydown', (e) => {
    if (UI.winModal && !UI.winModal.classList.contains('hidden')) return;

    if (BLOCK_KEYS.has(e.key)) e.preventDefault(); // stop scrolling in iframe/parent

    if (e.repeat) return;
    if (state.keyDownLock) return;
    state.keyDownLock = true;
    try {
        handleInput(e.code);
    } finally {
        setTimeout(() => { state.keyDownLock = false; }, 0);
    }
}, { passive: false });

// ---------- Focus / Visibility ----------
window.addEventListener('blur', () => pauseTimer());
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pauseTimer(); }
    else if (state.elapsedBeforePause > 0 && state.player && !(state.player.r === state.end.r && state.player.c === state.end.c)) {
        resumeTimer();
    }
});

// ---------- UI Events ----------
UI.newBtn.addEventListener('click', () => { hideWinModal(); regenerate(); });
UI.difficulty.addEventListener('change', async () => {
    state.difficulty = UI.difficulty.value;
    await new Promise(resolve => chrome.storage.local.set({ difficulty: state.difficulty }, resolve));
    hideWinModal();
    regenerate();
});
UI.modalNew.addEventListener('click', () => { hideWinModal(); regenerate(); });
UI.modalChange.addEventListener('click', () => { hideWinModal(); UI.difficulty.focus(); });

UI.colorblind.addEventListener('change', () => {
    state.colorblind = UI.colorblind.checked;
    chrome.storage.local.set({ colorblind: state.colorblind });
    draw();
});
UI.mute.addEventListener('change', () => {
    state.muted = UI.mute.checked;
    audio.muted = state.muted;
    chrome.storage.local.set({ muted: state.muted });
});

// ---------- Responsive Canvas Sizing ----------
function fitCanvas() {
    const wrap = document.querySelector('.canvas-wrap');
    const style = getComputedStyle(wrap);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const w = wrap.clientWidth - padX - 2;
    const h = wrap.clientHeight - padY - 2;
    const width = Math.min(360, w);
    const height = Math.min(420, h);

    const cssW = Math.max(260, Math.floor(width));
    const cssH = Math.max(320, Math.floor(height));
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    UI.canvas.style.width = cssW + 'px';
    UI.canvas.style.height = cssH + 'px';
    UI.canvas.width = cssW * dpr;
    UI.canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
}
window.addEventListener('resize', fitCanvas);

// ---------- Init ----------
(async function init() {
    await loadBestTimesAndPrefs();
    fitCanvas();
    regenerate();

    // Give focus to the canvas so key events go to the game immediately
    UI.canvas.focus();
    UI.canvas.addEventListener('pointerdown', () => UI.canvas.focus());

    // Optional: disable scrolling inside the iframe document itself
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
})();
