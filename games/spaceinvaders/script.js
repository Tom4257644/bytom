/* Space Invaders — compact, iframe-safe, with hard loss check
   Controls: ←/→ or A/D • Space fire • P pause • R restart
   Mobile: buttons below canvas (press-and-hold)
*/
(function () {
    // ----- Embed mode (optional tighter CSS when inside iframe) -----
    const root = document.getElementById('si-root');
    try { if (window.self !== window.top) root?.classList.add('embed'); } catch { root?.classList.add('embed'); }

    // ----- Canvas / UI -----
    const canvas = document.getElementById('board');
    const ctx = canvas.getContext('2d', { alpha: true });

    const scoreEl = document.getElementById('score');
    const livesEl = document.getElementById('lives');
    const waveEl = document.getElementById('wave');

    const btnPause = document.getElementById('btn-pause');
    const btnRestart = document.getElementById('btn-restart');

    const overlay = document.getElementById('overlay');
    const ovlTitle = document.getElementById('ovl-title');
    const ovlSub = document.getElementById('ovl-sub');
    const ovlStart = document.getElementById('ovl-start');
    const ovlContinue = document.getElementById('ovl-continue');
    const ovlRestart = document.getElementById('ovl-restart');

    const tLeft = document.getElementById('t-left');
    const tRight = document.getElementById('t-right');
    const tFire = document.getElementById('t-fire');

    // ----- Game state -----
    const GS = {
        running: false,
        paused: false,
        score: 0,
        lives: 3,
        wave: 1,
        width: 900,   // device-pixel canvas size (fitCanvas updates)
        height: 600,
        lastTime: 0,
        acc: 0,
        step: 1000 / 60,  // fixed timestep in ms
    };

    // ----- Canvas sizing: match pixel buffer to CSS box -----
    function fitCanvas() {
        const r = canvas.getBoundingClientRect();
        const cssW = Math.max(200, r.width);
        const cssH = Math.max(160, r.height || r.width * (2 / 3));
        const dpr = Math.max(1, Math.min(devicePixelRatio || 1, 2));
        const w = Math.floor(cssW * dpr);
        const h = Math.floor(cssH * dpr);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w; canvas.height = h;
        }
        GS.width = w; GS.height = h;
    }
    addEventListener('resize', fitCanvas, { passive: true });
    setTimeout(fitCanvas, 0);
    setTimeout(fitCanvas, 150);
    fitCanvas();

    // ----- Helpers -----
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    // ----- Entities -----
    class Player {
        constructor() {
            const w = Math.max(40, GS.width * 0.04);
            const h = Math.max(20, GS.height * 0.03);
            this.w = w; this.h = h;
            this.x = (GS.width - w) / 2;
            this.y = GS.height - h - Math.max(16, GS.height * 0.02);
            this.speed = Math.max(240, GS.width * 0.28);
            this.cool = 0; this.coolEvery = 270; // ms
            this.inv = 0;                      // ms
        }
        get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
        update(dt, input) {
            const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
            this.x += dir * this.speed * dt;
            this.x = clamp(this.x, 8, GS.width - this.w - 8);
            this.cool = Math.max(0, this.cool - dt * 1000);
            this.inv = Math.max(0, this.inv - dt * 1000);
        }
        canFire() { return this.cool <= 0; }
        fired() { this.cool = this.coolEvery; }
        draw(ctx) {
            const { x, y, w, h } = this;
            ctx.save(); ctx.translate(x, y);
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#7dd3fc'); g.addColorStop(1, '#22d3ee');
            ctx.fillStyle = g; ctx.strokeStyle = '#0ea5b7';
            ctx.lineWidth = Math.max(2, GS.width * 0.0022);
            ctx.beginPath();
            ctx.moveTo(0.1 * w, 0.8 * h);
            ctx.quadraticCurveTo(0.5 * w, 0, 0.9 * w, 0.8 * h);
            ctx.quadraticCurveTo(0.5 * w, h, 0.1 * w, 0.8 * h);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#e879f9'; ctx.strokeStyle = '#a21caf';
            ctx.beginPath(); ctx.ellipse(0.5 * w, 0.45 * h, 0.22 * w, 0.32 * h, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            if (this.inv > 0) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = 'rgba(255,255,255,.7)';
                ctx.lineWidth = Math.max(2, GS.width * 0.002);
                ctx.strokeRect(-6, -6, w + 12, h + 12);
            }
            ctx.restore();
        }
    }

    class Laser {
        constructor(x, y) {
            this.w = Math.max(4, GS.width * 0.004);
            this.h = Math.max(16, GS.height * 0.03);
            this.x = x - this.w / 2; this.y = y - this.h;
            this.v = Math.max(420, GS.height * 0.8);
            this.dead = false;
        }
        get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
        update(dt) { this.y -= this.v * dt; if (this.y + this.h < 0) this.dead = true; }
        draw(ctx) {
            const g = ctx.createLinearGradient(0, this.y, 0, this.y + this.h);
            g.addColorStop(0, '#22d3ee'); g.addColorStop(1, '#8b5cf6');
            ctx.fillStyle = g; ctx.fillRect(this.x, this.y, this.w, this.h);
        }
    }

    class Bomb {
        constructor(x, y) {
            this.w = Math.max(3, GS.width * 0.0038);
            this.h = Math.max(7, GS.height * 0.014);
            this.x = x - this.w / 2; this.y = y;
            this.v = Math.max(200, GS.height * 0.40);
            this.dead = false;
            this.swing = (Math.random() * 0.8 + 0.6) * (Math.random() < .5 ? -1 : 1);
        }
        get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
        update(dt) {
            this.y += this.v * dt;
            this.x += this.swing * (GS.width * 0.03) * dt;
            if (this.y > GS.height) this.dead = true;
        }
        draw(ctx) { ctx.fillStyle = '#f43f5e'; ctx.fillRect(this.x, this.y, this.w, this.h); }
    }

    class Invader {
        constructor(x, y, kind = 0) {
            this.w = Math.max(28, GS.width * 0.03);
            this.h = Math.max(22, GS.height * 0.036);
            this.x = x; this.y = y; this.kind = kind;
            this.alive = true; this.flash = 0;
        }
        get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
        update(dt) { this.flash = Math.max(0, this.flash - dt * 1000); }
        draw(ctx) {
            if (!this.alive) return;
            ctx.save(); ctx.translate(this.x, this.y);
            const hue = [190, 140, 60][this.kind];
            const body = this.flash > 0 ? '#fff' : `hsl(${hue} 85% 60%)`;
            const edge = `hsl(${hue} 90% 35%)`;
            ctx.fillStyle = body; ctx.strokeStyle = edge; ctx.lineWidth = Math.max(2, GS.width * 0.0018);
            const w = this.w, h = this.h, r = Math.min(w, h) * 0.15;
            ctx.beginPath();
            ctx.moveTo(r, 0); ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r); ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#0f172a';
            const eW = w * 0.18, eH = h * 0.28;
            ctx.fillRect(w * 0.2, h * 0.3, eW, eH);
            ctx.fillRect(w * (1 - 0.2) - eW, h * 0.3, eW, eH);
            ctx.restore();
        }
    }

    class Shield {
        constructor(x, y, scale = 1) {
            this.x = x; this.y = y; this.scale = scale;
            this.cols = 10; this.rows = 6;
            this.cell = Math.max(6, GS.width * 0.008) * scale;
            this.hp = Array.from({ length: this.rows }, () => Array(this.cols).fill(2));
            for (let r = this.rows - 2; r < this.rows; r++) for (let c = 4; c < 6; c++) this.hp[r][c] = 0;
        }
        hitRect() { return { x: this.x, y: this.y, w: this.cols * this.cell, h: this.rows * this.cell }; }
        damageIfHit(rect) {
            const a = this.hitRect(); if (!overlap(a, rect)) return false;
            const lx1 = Math.floor((rect.x - this.x) / this.cell), lx2 = Math.floor((rect.x + rect.w - this.x) / this.cell);
            const ly1 = Math.floor((rect.y - this.y) / this.cell), ly2 = Math.floor((rect.y + rect.h - this.y) / this.cell);
            for (let r = Math.max(0, ly1); r <= Math.min(this.rows - 1, ly2); r++) {
                for (let c = Math.max(0, lx1); c <= Math.min(this.cols - 1, lx2); c++) {
                    if (this.hp[r][c] > 0) { this.hp[r][c]--; return true; }
                }
            }
            return false;
        }
        draw(ctx) {
            const s = this.cell;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const v = this.hp[r][c]; if (v <= 0) continue;
                    ctx.fillStyle = v === 2 ? '#84cc16' : '#a3e635';
                    ctx.fillRect(this.x + c * s, this.y + r * s, s - 1, s - 1);
                }
            }
        }
    }

    // ----- World containers / pacing -----
    let player, lasers, bombs, invaders, shields;
    let invDir = 1, invVX = 26, invStepT = 0, invStepEvery = 700, dropAmt = 0;

    function resetWave(wave = 1) {
        player = new Player();
        lasers = []; bombs = []; invaders = []; shields = [];

        // Tight vertical layout for short canvas
        const cols = 11, rows = 5;
        const padX = GS.width * 0.06;
        const padY = GS.height * 0.04;
        const sX = (GS.width - padX * 2) / cols;
        const sY = Math.max(22, GS.height * 0.045);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                invaders.push(new Invader(padX + c * sX, padY + r * sY, Math.floor(r / 2)));
            }
        }

        const shieldY = GS.height * 0.66;
        for (let i = 0; i < 3; i++) {
            const x = (GS.width / 4) * (i + 1) - (10 * Math.max(6, GS.width * 0.008)) / 2;
            shields.push(new Shield(x, shieldY, 1));
        }

        invDir = 1;
        invVX = 22 + (wave - 1) * 3;
        invStepEvery = Math.max(260, 700 - (wave - 1) * 60);
        invStepT = 0;
        dropAmt = Math.max(4, GS.height * 0.012); // small descent per bounce
    }

    function resetAll() { GS.score = 0; GS.lives = 3; GS.wave = 1; updateHUD(); resetWave(1); }

    // ----- Input -----
    const input = { left: false, right: false, fire: false };
    let fireHeld = false;

    function key(e, down) {
        if (e.repeat) return;
        const k = e.key.toLowerCase();
        if (k === 'arrowleft' || k === 'a') { input.left = down; e.preventDefault(); }
        if (k === 'arrowright' || k === 'd') { input.right = down; e.preventDefault(); }
        if (k === ' ') { fireHeld = down; if (down) input.fire = true; e.preventDefault(); }
        if (k === 'p' && down) togglePause();
        if (k === 'r' && down) restart();
    }
    addEventListener('keydown', e => key(e, true));
    addEventListener('keyup', e => key(e, false));

    // Mobile press-and-hold
    let touchL = false, touchR = false, touchF = false;
    function hold(el, downFn, upFn) {
        if (!el) return;
        const down = e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch { } downFn(); };
        const up = e => { e.preventDefault(); upFn(); };
        el.addEventListener('pointerdown', down, { passive: false });
        el.addEventListener('pointerup', up, { passive: false });
        el.addEventListener('pointercancel', up, { passive: false });
        el.addEventListener('pointerleave', up, { passive: false });
    }
    hold(tLeft, () => { touchL = true; }, () => { touchL = false; });
    hold(tRight, () => { touchR = true; }, () => { touchR = false; });
    hold(tFire, () => { touchF = true; input.fire = true; }, () => { touchF = false; });

    // ----- Overlay / controls -----
    function startGame() { resetAll(); hideOverlay(); resume(); }
    function restart() { resetAll(); if (GS.paused) resume(); }
    function togglePause() { if (!GS.running) return; GS.paused ? resume() : pause(); }
    function pause() {
        GS.paused = true;
        ovlTitle.textContent = 'Paused';
        ovlSub.textContent = 'Press P to resume • R to restart';
        ovlStart.classList.add('hidden');
        ovlContinue.classList.remove('hidden');
        ovlRestart.classList.remove('hidden');
        showOverlay();
    }
    function resume() { GS.paused = false; GS.running = true; GS.lastTime = performance.now(); hideOverlay(); requestAnimationFrame(loop); }
    function gameOver() {
        GS.running = false; GS.paused = true;
        ovlTitle.textContent = 'Game Over';
        ovlSub.textContent = `Final score: ${GS.score}`;
        ovlStart.classList.add('hidden');
        ovlContinue.classList.add('hidden');
        ovlRestart.classList.remove('hidden');
        showOverlay();
    }
    function showOverlay() { overlay.classList.remove('hidden'); }
    function hideOverlay() { overlay.classList.add('hidden'); }
    function updateHUD() { scoreEl.textContent = `Score: ${GS.score}`; livesEl.textContent = `Lives: ${GS.lives}`; waveEl.textContent = `Wave: ${GS.wave}`; }

    btnPause?.addEventListener('click', togglePause);
    btnRestart?.addEventListener('click', restart);
    ovlStart?.addEventListener('click', startGame);
    ovlContinue?.addEventListener('click', () => { hideOverlay(); resume(); });
    ovlRestart?.addEventListener('click', () => { hideOverlay(); restart(); });

    // ----- Update -----
    function update(dt) {
        // input merge
        input.left = input.left || touchL;
        input.right = input.right || touchR;
        fireHeld = fireHeld || touchF;

        // player
        player.update(dt, input);
        if ((input.fire || fireHeld) && player.canFire()) {
            lasers.push(new Laser(player.x + player.w / 2, player.y));
            player.fired();
        }
        input.fire = false;

        // invader marching (stepwise)
        invStepT += dt * 1000;
        if (invStepT >= invStepEvery) {
            invStepT = 0;
            let bounce = false;
            const vx = invVX * invDir * (GS.width / 900);
            for (const inv of invaders) {
                if (!inv.alive) continue;
                inv.x += vx;
                if (inv.x < 10 || inv.x + inv.w > GS.width - 10) bounce = true;
            }
            if (bounce) {
                invDir *= -1;
                for (const inv of invaders) {
                    if (!inv.alive) continue;
                    inv.y += dropAmt;
                }
                invStepEvery = Math.min(invStepEvery, Math.max(120, invStepEvery - 18));
            }
        }
        for (const inv of invaders) inv.update(dt);

        // ----- HARD LOSS CHECK (runs every frame, right after invaders move) -----
        // Define a loss line slightly above the player's top so tiny overlaps still count.
        const lossLineY = player.y - Math.max(1, player.h * 0.15);
        for (const inv of invaders) {
            if (!inv.alive) continue;
            if (inv.y + inv.h >= lossLineY) { gameOver(); return; }      // reached your line
            if (overlap(inv.rect, player.rect)) { gameOver(); return; }   // direct overlap
        }

        // lasers
        lasers.forEach(l => l.update(dt));
        lasers = lasers.filter(l => !l.dead);

        // bombs (fewer invaders -> higher rate)
        const alive = invaders.filter(i => i.alive);
        if (alive.length) {
            const rate = Math.max(0.15, Math.min(0.9, 0.9 - alive.length / 24));
            if (Math.random() < rate * dt) {
                const s = alive[(Math.random() * alive.length) | 0];
                bombs.push(new Bomb(s.x + s.w / 2, s.y + s.h));
            }
        }
        bombs.forEach(b => b.update(dt));
        bombs = bombs.filter(b => !b.dead);

        // collisions: lasers vs invaders
        for (const l of lasers) {
            for (const inv of invaders) {
                if (!inv.alive) continue;
                if (overlap(l.rect, inv.rect)) {
                    l.dead = true; inv.alive = false; inv.flash = 120;
                    GS.score += 10 + inv.kind * 5;
                    break;
                }
            }
        }

        // lasers vs shields
        for (const l of lasers) {
            for (const s of shields) { if (s.damageIfHit(l.rect)) { l.dead = true; break; } }
        }

        // bombs vs shields/player
        for (const b of bombs) {
            let hit = false;
            for (const s of shields) { if (s.damageIfHit(b.rect)) { hit = true; break; } }
            if (hit) { b.dead = true; continue; }
            if (overlap(b.rect, player.rect)) {
                b.dead = true;
                if (player.inv <= 0) {
                    GS.lives--; player.inv = 1500;
                    if (GS.lives <= 0) { gameOver(); return; }
                }
            }
        }
        lasers = lasers.filter(l => !l.dead);
        bombs = bombs.filter(b => !b.dead);

        // wave cleared?
        if (invaders.every(i => !i.alive)) { GS.wave++; updateHUD(); resetWave(GS.wave); }

        updateHUD();
    }

    // ----- Render -----
    function bg() {
        ctx.save(); ctx.globalAlpha = .85;
        const n = 90;
        for (let i = 0; i < n; i++) {
            const x = (i * 73) % GS.width, y = (i * i * 19) % GS.height;
            ctx.fillStyle = (i % 7 === 0) ? '#fff' : '#9ca3af';
            ctx.fillRect(x, y, 2, 2);
        }
        ctx.restore();
        const g = ctx.createRadialGradient(GS.width / 2, GS.height * 1.05, GS.height * 0.1, GS.width / 2, GS.height * 1.05, GS.height * 0.65);
        g.addColorStop(0, 'rgba(34,211,238,0.10)'); g.addColorStop(1, 'rgba(34,211,238,0)');
        ctx.fillStyle = g; ctx.fillRect(0, GS.height * 0.4, GS.width, GS.height * 0.6);
    }
    function render() {
        ctx.clearRect(0, 0, GS.width, GS.height);
        bg();
        shields.forEach(s => s.draw(ctx));
        player.draw(ctx);
        invaders.forEach(i => i.draw(ctx));
        lasers.forEach(l => l.draw(ctx));
        bombs.forEach(b => b.draw(ctx));
    }

    // ----- Main loop -----
    function loop(now) {
        if (!GS.running || GS.paused) return;
        fitCanvas();
        const dtMs = now - GS.lastTime; GS.lastTime = now; GS.acc += dtMs;
        GS.acc = Math.min(GS.acc, 1000);
        while (GS.acc >= GS.step) {
            const dt = GS.step / 1000;
            update(dt);
            GS.acc -= GS.step;
            if (!GS.running) return;
        }
        render();
        requestAnimationFrame(loop);
    }

    // ----- Init -----
    function init() {
        resetAll();
        ovlTitle.textContent = 'SPACE INVADERS';
        ovlSub.textContent = '← → or A/D to move • Space to shoot • P to pause';
        overlay.classList.remove('hidden'); // show start overlay
    }

    // Public hook (optional)
    window.__SI__ = { get state() { return GS; } };

    // Start
    btnPause?.addEventListener('click', togglePause);
    btnRestart?.addEventListener('click', restart);
    ovlStart?.addEventListener('click', startGame);
    ovlContinue?.addEventListener('click', () => { overlay.classList.add('hidden'); resume(); });
    ovlRestart?.addEventListener('click', () => { overlay.classList.add('hidden'); restart(); });

    init();
})();
