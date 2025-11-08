/* SNAKE — fully rewritten, responsive, wrap ON by default */

(function () {
    // ----- DOM -----
    const canvas = document.getElementById('board');
    const ctx = canvas.getContext('2d');

    const scoreEl = document.getElementById('score');
    const speedEl = document.getElementById('speed');

    const overlay = document.getElementById('overlay');
    const ovlTitle = document.getElementById('overlay-title');
    const ovlSub = document.getElementById('overlay-sub');
    const ovlResume = document.getElementById('ovl-resume');
    const ovlRestart = document.getElementById('ovl-restart');

    const btnPause = document.getElementById('btn-pause');
    const btnRestart = document.getElementById('btn-restart');
    const btnSettings = document.getElementById('btn-settings');
    const btnMute = document.getElementById('btn-mute');

    const dlg = document.getElementById('settings');
    const optWrap = document.getElementById('opt-wrap');
    const optGrid = document.getElementById('opt-grid');
    const optVibrate = document.getElementById('opt-vibrate');

    const dpad = document.querySelector('.dpad');
    const dButtons = dpad.querySelectorAll('button');

    // ----- STATE -----
    let GRID = 24;          // columns/rows
    let CELL = 0;           // px (computed)
    let wrapWalls = true;   // default ON
    let vibrateOnEat = true;

    let snake = [];
    let dir = { x: 1, y: 0 };
    let turnBuffer = [];
    let food = { x: 5, y: 5 };
    let score = 0;

    let running = false;
    let gameOver = false;
    let lastTime = 0;
    let tickAccum = 0;
    let tickMs = 180;
    const tickMin = 70;

    // Audio
    let audioCtx = null;
    let muted = false;

    function beep(freq = 440, dur = 0.06, type = 'sine', vol = 0.03) {
        if (muted) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = type;
            o.frequency.value = freq;
            g.gain.value = vol;
            o.connect(g); g.connect(audioCtx.destination);
            o.start();
            setTimeout(() => { o.stop(); o.disconnect(); g.disconnect(); }, dur * 1000);
        } catch (_) { /* ignore */ }
    }

    // ----- LAYOUT -----
    function fitCanvas() {
        const parent = canvas.parentElement; // .board-area
        const rect = parent.getBoundingClientRect();

        const headerBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
        const availH = Math.max(260, window.innerHeight - headerBottom - 170);

        const cssSize = Math.floor(Math.min(rect.width - 24, availH - 24));
        const size = Math.max(220, cssSize);

        const dpr = window.devicePixelRatio || 1;

        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        canvas.width = Math.floor(size * dpr);
        canvas.height = Math.floor(size * dpr);

        CELL = Math.floor(canvas.width / dpr / GRID);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', fitCanvas, { passive: true });

    // ----- GAME -----
    function newGame() {
        gameOver = false;
        running = true;
        score = 0;
        tickMs = 180;
        dir = { x: 1, y: 0 };
        turnBuffer = [];

        const cx = Math.floor(GRID / 2), cy = Math.floor(GRID / 2);
        snake = [{ x: cx + 1, y: cy }, { x: cx, y: cy }, { x: cx - 1, y: cy }];

        spawnFood();
        updateHUD();
        hideOverlay();
        requestAnimationFrame(loop);
    }

    function spawnFood() {
        // random empty cell
        while (true) {
            const x = Math.floor(Math.random() * GRID);
            const y = Math.floor(Math.random() * GRID);
            if (!snake.some(s => s.x === x && s.y === y)) {
                food = { x, y };
                return;
            }
        }
    }

    function enqueueTurn(nx, ny) {
        const last = turnBuffer[turnBuffer.length - 1] || dir;
        if (last.x === nx && last.y === ny) return;         // duplicate
        if (last.x === -nx && last.y === -ny) return;       // 180° same tick
        turnBuffer.push({ x: nx, y: ny });
    }

    function step() {
        if (turnBuffer.length) dir = turnBuffer.shift();

        let nx = snake[0].x + dir.x;
        let ny = snake[0].y + dir.y;

        if (wrapWalls) {
            nx = (nx + GRID) % GRID;
            ny = (ny + GRID) % GRID;
        } else {
            if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) { endGame(); return; }
        }

        // self collision
        if (snake.some(seg => seg.x === nx && seg.y === ny)) {
            endGame(); return;
        }

        snake.unshift({ x: nx, y: ny });

        if (nx === food.x && ny === food.y) {
            score += 10;
            if (vibrateOnEat && 'vibrate' in navigator) navigator.vibrate?.(20);
            beep(700, .05, 'square', .035);
            spawnFood();
            const target = Math.max(tickMin, 180 - Math.floor(score / 20) * 10);
            tickMs = target;
        } else {
            snake.pop();
        }
    }

    function endGame() {
        running = false;
        gameOver = true;
        beep(220, .08, 'sawtooth', .05);
        beep(160, .12, 'sawtooth', .05);
        showOverlay('Game Over', `Final score: ${score}. Press R to play again.`);
    }

    function updateHUD() {
        scoreEl.textContent = `Score: ${score}`;
        const mult = (180 / tickMs).toFixed(1);
        speedEl.textContent = `Speed: ${mult}x`;
        // refresh grid background hint lines to match GRID
        canvas.style.backgroundSize =
            `calc(100% / ${GRID}) 100%, 100% calc(100% / ${GRID}), auto`;
    }

    // ----- RENDER -----
    function draw() {
        const cs = Math.floor(canvas.clientWidth / GRID);
        const pad = Math.max(1, Math.floor(cs * 0.08));

        // clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // food
        ctx.fillStyle = getCSS('--food', '#ffd166');
        rounded(cs * food.x + pad, cs * food.y + pad, cs - 2 * pad, cs - 2 * pad, 6, true);

        // snake
        const snakeColor = getCSS('--snake', '#a7f0ff');
        const headColor = getCSS('--snake-head', '#55c1ff');

        snake.forEach((seg, i) => {
            ctx.fillStyle = i === 0 ? headColor : snakeColor;
            const r = i === 0 ? 8 : 10;
            rounded(cs * seg.x + pad, cs * seg.y + pad, cs - 2 * pad, cs - 2 * pad, r, true);

            if (i === 0) {
                // tiny eyes
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = '#000';
                const eye = Math.max(2, Math.floor((cs - 2 * pad) * 0.12));
                ctx.fillRect(seg.x * cs + pad + eye, seg.y * cs + pad + eye, eye, eye);
                ctx.fillRect(seg.x * cs + pad + (cs - 2 * pad) - 2 * eye, seg.y * cs + pad + eye, eye, eye);
                ctx.globalAlpha = 1;
            }
        });

        function getCSS(name, fallback) {
            const v = getComputedStyle(document.documentElement).getPropertyValue(name);
            return (v && v.trim()) || fallback;
        }
    }

    function rounded(x, y, w, h, r, fill) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        if (fill) ctx.fill();
    }

    // ----- LOOP -----
    function loop(ts) {
        if (!running) { draw(); return; }
        if (!lastTime) lastTime = ts;
        const dt = ts - lastTime;
        lastTime = ts;
        tickAccum += dt;

        while (tickAccum >= tickMs) {
            tickAccum -= tickMs;
            step();
            updateHUD();
            if (gameOver) break;
        }

        draw();
        if (running) requestAnimationFrame(loop);
    }

    // ----- UI -----
    function showOverlay(title, sub) {
        ovlTitle.textContent = title;
        ovlSub.textContent = sub;
        overlay.classList.remove('hidden');
    }
    function hideOverlay() {
        overlay.classList.add('hidden');
    }
    function pauseGame() {
        if (gameOver) return;
        if (running) {
            running = false;
            showOverlay('Paused', 'Press P or tap Resume to continue.');
        }
    }
    function resumeGame() {
        if (gameOver) return;
        if (!running) {
            hideOverlay();
            running = true;
            lastTime = 0; tickAccum = 0;
            requestAnimationFrame(loop);
        }
    }

    // ----- INPUT -----
    function onKey(e) {
        const k = e.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();

        if (k === 'p') { running ? pauseGame() : resumeGame(); return; }
        if (k === 'r') { newGame(); return; }
        if (k === 'm') {
            muted = !muted;
            btnMute.dataset.muted = String(muted);
            btnMute.textContent = muted ? '🔇' : '🔊';
            return;
        }

        if (!running) return;

        if (k === 'arrowup' || k === 'w') enqueueTurn(0, -1);
        else if (k === 'arrowdown' || k === 's') enqueueTurn(0, 1);
        else if (k === 'arrowleft' || k === 'a') enqueueTurn(-1, 0);
        else if (k === 'arrowright' || k === 'd') enqueueTurn(1, 0);
    }
    window.addEventListener('keydown', onKey, { passive: false });

    // D-pad
    dButtons.forEach(b => {
        b.addEventListener('click', () => {
            if (!running) return;
            const d = b.dataset.dir;
            if (d === 'up') enqueueTurn(0, -1);
            if (d === 'down') enqueueTurn(0, 1);
            if (d === 'left') enqueueTurn(-1, 0);
            if (d === 'right') enqueueTurn(1, 0);
        });
    });

    // Swipe
    let touchStart = null;
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }, { passive: true });
    canvas.addEventListener('touchend', (e) => {
        if (!touchStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.x;
        const dy = t.clientY - touchStart.y;
        const ax = Math.abs(dx), ay = Math.abs(dy);
        const min = 18;
        if (ax < min && ay < min) { touchStart = null; return; }
        if (ax > ay) {
            if (dx > 0) enqueueTurn(1, 0); else enqueueTurn(-1, 0);
        } else {
            if (dy > 0) enqueueTurn(0, 1); else enqueueTurn(0, -1);
        }
        touchStart = null;
    }, { passive: true });

    // Buttons
    btnPause.addEventListener('click', () => running ? pauseGame() : resumeGame());
    btnRestart.addEventListener('click', newGame);
    btnSettings.addEventListener('click', () => {
        // sync current values
        optGrid.value = String(GRID);
        optWrap.checked = wrapWalls;
        optVibrate.checked = vibrateOnEat;
        dlg.showModal();
    });
    document.getElementById('settings-cancel').addEventListener('click', (e) => { e.preventDefault(); dlg.close(); });
    document.getElementById('settings-apply').addEventListener('click', (e) => {
        e.preventDefault();
        const newGrid = Math.max(12, Math.min(60, parseInt(optGrid.value, 10) || GRID));
        const gridChanged = newGrid !== GRID;
        GRID = newGrid;
        wrapWalls = !!optWrap.checked;       // stays true by default unless user turns it off
        vibrateOnEat = !!optVibrate.checked;
        dlg.close();
        fitCanvas();
        if (gridChanged) newGame(); else updateHUD();
    });

    btnMute.addEventListener('click', () => {
        muted = !muted;
        btnMute.dataset.muted = String(muted);
        btnMute.textContent = muted ? '🔇' : '🔊';
    });

    ovlResume.addEventListener('click', resumeGame);
    ovlRestart.addEventListener('click', newGame);

    // ----- STARTUP -----
    optGrid.value = String(GRID);
    optWrap.checked = true;     // DEFAULT: wrap ON ✅
    fitCanvas();
    newGame();
})();
