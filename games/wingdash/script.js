/* Wing Dash — Vanilla JS, responsive, high-DPI safe */

(() => {
    // ====== DOM ======
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    const overlayStart = document.getElementById('overlay');
    const overlayPause = document.getElementById('overlay-pause');
    const overlayOver = document.getElementById('overlay-gameover');

    const btnPlay = document.getElementById('btn-play');
    const btnPlayAgain = document.getElementById('btn-play-again');
    const btnResume = document.getElementById('btn-resume');
    const btnRestartTop = document.getElementById('btn-restart');
    const btnRestartPause = document.getElementById('btn-restart2');
    const btnPause = document.getElementById('btn-pause');

    const scoreEl = document.getElementById('score');
    const bestEl = document.getElementById('best');
    const finalScore = document.getElementById('final-score');
    const finalBest = document.getElementById('final-best');

    // ====== Virtual game size (we render at any CSS size, but simulate on this grid) ======
    // Portrait-friendly aspect; will scale up/down to fit container.
    let VW = 360;  // virtual width
    let VH = 640;  // virtual height

    // Device pixel ratio scaling for crisp text/lines.
    function resizeCanvas() {
        // Fill the stage area
        const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
        const rect = canvas.getBoundingClientRect();

        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
        // Compute mapping from virtual -> css px while preserving aspect
        const stageAspect = rect.width / rect.height;
        const virtualAspect = VW / VH;

        if (stageAspect > virtualAspect) {
            // stage is wider -> letterbox sides
            renderScale = rect.height / VH;
            renderOffsetX = (rect.width - VW * renderScale) / 2;
            renderOffsetY = 0;
        } else {
            // stage is taller -> letterbox top/bottom
            renderScale = rect.width / VW;
            renderOffsetX = 0;
            renderOffsetY = (rect.height - VH * renderScale) / 2;
        }
    }

    let renderScale = 1;
    let renderOffsetX = 0;
    let renderOffsetY = 0;

    window.addEventListener('resize', resizeCanvas, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 50), { passive: true });

    // ====== Helpers to map virtual -> canvas ======
    function toScreen(x, y) {
        return [renderOffsetX + x * renderScale, renderOffsetY + y * renderScale];
    }
    function drawRect(x, y, w, h, fill) {
        const [sx, sy] = toScreen(x, y);
        ctx.fillStyle = fill;
        ctx.fillRect(sx, sy, w * renderScale, h * renderScale);
    }
    function drawCircle(x, y, r, fill) {
        const [sx, sy] = toScreen(x, y);
        ctx.beginPath();
        ctx.arc(sx, sy, r * renderScale, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
    }
    function drawText(txt, x, y, size = 24, color = '#0f172a', align = 'center') {
        const [sx, sy] = toScreen(x, y);
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.floor(size * renderScale)}px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Arial, sans-serif`;
        ctx.fillText(txt, sx, sy);
    }

    // ====== Game state ======
    const state = {
        running: false,
        paused: false,
        started: false,
        gameOver: false,
        score: 0,
        best: Number(localStorage.getItem('wingdash_best') || 0),

        bird: {
            x: VW * 0.28,
            y: VH * 0.5,
            r: 10,           // radius
            vy: 0,           // vertical velocity
        },

        pipes: [],
        time: 0,
        nextPipeIn: 0,
    };

    // Physics & tuning (scale with virtual size)
    const GRAVITY = 0.0009 * VH;        // px per ms^2
    const FLAP_IMP = -0.33 * Math.sqrt(VH); // negative upward impulse
    const GROUND_Y = VH - 80;           // visual ground line
    const PIPE_GAP = 0.22 * VH;         // vertical gap
    const PIPE_W = Math.max(48, 0.12 * VW);
    const PIPE_MIN = 0.10 * VH;
    const PIPE_MAX = GROUND_Y - PIPE_GAP - PIPE_MIN;
    const PIPE_SPAWN_MS = 2500;
    const SCROLL_VX = -0.18 * VW / 1000; // px per ms
    const BIRD_X = state.bird.x;

    // ====== Controls ======
    function flap() {
        if (!state.started) {
            startGame();
            return;
        }
        if (!state.running || state.paused || state.gameOver) return;
        state.bird.vy = FLAP_IMP;
    }

    function togglePause() {
        if (!state.started || state.gameOver) return;
        state.paused = !state.paused;
        overlayPause.classList.toggle('show', state.paused);
        if (!state.paused) lastTs = performance.now(); // resume timer
    }

    function restart() {
        state.running = false;
        state.paused = false;
        state.started = false;
        state.gameOver = false;
        state.score = 0;
        state.pipes.length = 0;

        state.bird.x = BIRD_X;
        state.bird.y = VH * 0.5;
        state.bird.vy = 0;

        state.time = 0;
        state.nextPipeIn = 400;

        scoreEl.textContent = '0';
        bestEl.textContent = String(state.best);
        overlayPause.classList.remove('show');
        overlayOver.classList.remove('show');
        overlayStart.classList.add('show');
        draw(); // render fresh idle frame
    }

    function startGame() {
        overlayStart.classList.remove('show');
        overlayPause.classList.remove('show');
        overlayOver.classList.remove('show');
        state.started = true;
        state.running = true;
        state.paused = false;
        lastTs = performance.now();
        requestAnimationFrame(loop);
    }

    // UI events
    btnPlay.addEventListener('click', startGame);
    btnPlayAgain.addEventListener('click', () => { restart(); startGame(); });
    btnResume.addEventListener('click', togglePause);
    btnRestartTop.addEventListener('click', restart);
    btnRestartPause.addEventListener('click', () => { restart(); startGame(); });
    btnPause.addEventListener('click', togglePause);

    // Keyboard
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
            e.preventDefault();
            flap();
        } else if (e.code === 'KeyP') {
            togglePause();
        } else if (e.code === 'KeyR') {
            restart();
            startGame();
        }
    });

    // Mouse / touch
    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        flap();
    }, { passive: false });

    // ====== Pipes ======
    function spawnPipePair() {
        const topH = PIPE_MIN + Math.random() * (PIPE_MAX - PIPE_MIN);
        const bottomY = topH + PIPE_GAP;
        state.pipes.push({
            x: VW + PIPE_W,
            topH,
            bottomY,
            w: PIPE_W,
            scored: false,
        });
    }

    // ====== Collision ======
    function birdRect() {
        const r = state.bird.r;
        return { x: state.bird.x - r, y: state.bird.y - r, w: 2 * r, h: 2 * r };
    }
    function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }
    function checkCollision() {
        const b = birdRect();
        // Ground / ceiling
        if (state.bird.y + state.bird.r >= GROUND_Y || state.bird.y - state.bird.r <= 0) return true;

        // Pipes
        for (const p of state.pipes) {
            // top pipe: from (p.x, 0) to (p.w, p.topH)
            if (rectsOverlap(b.x, b.y, b.w, b.h, p.x, 0, p.w, p.topH)) return true;
            // bottom pipe: from (p.x, p.bottomY) to ground
            if (rectsOverlap(b.x, b.y, b.w, b.h, p.x, p.bottomY, p.w, GROUND_Y - p.bottomY)) return true;
        }
        return false;
    }

    // ====== Game loop ======
    let lastTs = 0;
    function loop(ts) {
        if (!state.running) return;
        if (state.paused) { requestAnimationFrame(loop); return; }

        const dt = Math.min(32, ts - lastTs); // clamp delta for stability
        lastTs = ts;

        update(dt);
        draw();

        if (state.gameOver) return;
        requestAnimationFrame(loop);
    }

    function update(dt) {
        state.time += dt;
        state.nextPipeIn -= dt;

        // Scroll pipes left
        for (const p of state.pipes) {
            p.x += SCROLL_VX * dt;
            // scoring when passed
            if (!p.scored && p.x + p.w < state.bird.x - state.bird.r) {
                p.scored = true;
                state.score += 1;
                scoreEl.textContent = String(state.score);
            }
        }
        // Remove off-screen
        state.pipes = state.pipes.filter(p => p.x + p.w > -2);

        // Spawn
        if (state.nextPipeIn <= 0) {
            spawnPipePair();
            // Slightly accelerate spawn for difficulty but cap it
            const minSpawn = 950;
            const accel = Math.max(minSpawn, PIPE_SPAWN_MS - state.score * 8);
            state.nextPipeIn = accel;
        }

        // Bird physics
        state.bird.vy += GRAVITY * dt / 16.67; // normalized to ~60fps feel
        state.bird.y += state.bird.vy;

        // Collision check
        if (checkCollision()) {
            gameOver();
        }
    }

    function gameOver() {
        state.gameOver = true;
        state.running = false;

        // Best score
        if (state.score > state.best) {
            state.best = state.score;
            localStorage.setItem('wingdash_best', String(state.best));
        }
        finalScore.textContent = String(state.score);
        finalBest.textContent = String(state.best);
        bestEl.textContent = String(state.best);

        overlayOver.classList.add('show');
    }

    // ====== Drawing ======
    function drawBackground() {
        // A few parallax clouds
        const t = state.time * 0.02;
        ctx.globalAlpha = 0.15;
        for (let i = 0; i < 6; i++) {
            const x = ((i * 180 + t) % (VW + 220)) - 110;
            const y = 70 + (i % 3) * 40;
            drawCircle(x, y, 30, '#ffffff');
            drawCircle(x + 20, y + 5, 22, '#ffffff');
            drawCircle(x - 18, y + 8, 18, '#ffffff');
        }
        ctx.globalAlpha = 1;
        // Ground line
        drawRect(0, GROUND_Y - 2, VW, 2, 'rgba(0,0,0,0.08)');
    }

    function drawPipes() {
        for (const p of state.pipes) {
            // top
            drawRect(p.x, 0, p.w, p.topH, '#2e7d32');
            drawRect(p.x - 2, p.topH - 8, p.w + 4, 8, '#245f27'); // lip
            // bottom
            drawRect(p.x, p.bottomY, p.w, GROUND_Y - p.bottomY, '#2e7d32');
            drawRect(p.x - 2, p.bottomY, p.w + 4, 8, '#245f27');
        }
    }

    function drawBird() {
        // body
        drawCircle(state.bird.x, state.bird.y, state.bird.r, '#f59e0b');
        // eye
        drawCircle(state.bird.x + 6, state.bird.y - 4, 2.2, '#111827');
        // beak
        drawRect(state.bird.x + state.bird.r - 2, state.bird.y - 2, 8, 4, '#f97316');
        // wing (simple)
        drawCircle(state.bird.x - 4, state.bird.y + 2, 6, 'rgba(0,0,0,0.12)');
    }

    function draw() {
        // Clear full canvas in CSS pixels
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Letterbox background to avoid artifacts
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, rect.width, rect.height);

        drawBackground();
        drawPipes();
        drawBird();

        // Live score on field
        drawText(String(state.score), VW / 2, 60, 28, '#0f172a');
    }

    // ====== Init ======
    // First layout/paint
    resizeCanvas();
    bestEl.textContent = String(state.best);
    draw();

    // Restart to initial menu state
    restart();

    // Safety: ensure canvas resizes correctly after first layout pass
    setTimeout(() => { resizeCanvas(); draw(); }, 50);
})();
