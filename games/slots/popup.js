(function () {
    // ---------- Symbols ----------
    const SYMBOLS = [
        { name: 'Parrot', icon: '🦜' },
        { name: 'Anchor', icon: '⚓' },
        { name: 'Map', icon: '🗺️' },
        { name: 'Rum', icon: '🍾' },
        { name: 'Wheel', icon: '🧭' },
        { name: 'Coin', icon: '💰' },
        { name: 'Flag', icon: '🏴\u200d☠️' },
        { name: 'Skull', icon: '☠️', wild: true }
    ];

    // ---------- Elements / State ----------
    const REELS = 5, BASE_LEN = 22;
    const reelsEl = document.getElementById('reels');
    const spinBtn = document.getElementById('spin');
    const balanceEl = document.getElementById('balance');
    const lastWinEl = document.getElementById('lastwin');
    const resultEl = document.getElementById('result');
    const paylineEl = document.getElementById('payline');

    let CELL = 100;
    let balance = 100;
    let spinning = false;

    // ---------- Utils ----------
    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function remap(x, inMin, inMax, outMin, outMax) { const t = clamp((x - inMin) / (inMax - inMin), 0, 1); return lerp(outMin, outMax, t); }

    function measureCellPx() {
        const probe = document.createElement('div');
        probe.className = 'cell';
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.innerHTML = `<div class="chip"><span>🦜</span></div>`;
        document.body.appendChild(probe);
        const h = probe.getBoundingClientRect().height || 100;
        document.body.removeChild(probe);
        return h;
    }

    function layout() {
        CELL = measureCellPx();

        // Adaptive chip size: ~50% of cell on phones -> ~68% on desktops
        const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        const scale = remap(vw, 320, 1200, 0.50, 0.68);
        const chipPx = Math.round(CELL * scale);
        document.documentElement.style.setProperty('--chip', chipPx + 'px');

        // Precisely position the center payline
        const top = reelsEl.offsetTop + (CELL * 1.5) - 3; // 6px line -> -3px to center
        paylineEl.style.top = top + 'px';
    }

    // Initial layout + keep updated
    layout();
    if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(layout);
        ro.observe(document.body);
    } else {
        window.addEventListener('resize', layout);
        window.addEventListener('orientationchange', layout);
    }

    // ---------- Build reels (triple strip for continuous wrap) ----------
    const reels = [];
    for (let r = 0; r < REELS; r++) {
        const reel = document.createElement('div'); reel.className = 'reel';
        const strip = document.createElement('div'); strip.className = 'strip';
        reel.appendChild(strip); reelsEl.appendChild(reel);

        const base = Array.from({ length: BASE_LEN }, () => Math.floor(Math.random() * SYMBOLS.length));
        const order = [...base, ...base, ...base];

        order.forEach(idx => {
            const c = document.createElement('div'); c.className = 'cell';
            c.innerHTML = `<div class="chip"><span>${SYMBOLS[idx].icon}</span></div>`;
            strip.appendChild(c);
        });

        const start = -CELL * (BASE_LEN + Math.floor(Math.random() * BASE_LEN));
        strip.style.transform = `translateY(${start}px)`;
        reels.push({ reel, strip, order, offset: start });
    }

    // ---------- Spin ----------
    spinBtn.addEventListener('click', () => {
        if (spinning) return;
        if (balance <= 0) { setText('Out of coins.'); return; }

        layout(); // ensure alignment freshly computed

        spinning = true;
        spinBtn.disabled = true;
        setText('');
        updateBalance(-1);
        document.querySelectorAll('.win').forEach(x => x.classList.remove('win'));

        const lands = Array.from({ length: REELS }, () => BASE_LEN + 1 + Math.floor(Math.random() * (BASE_LEN - 2)));

        const timings = Array.from({ length: REELS }, (_, i) => ({
            delay: i * 140, anticipate: 120, accel: 380 + 60 * i, cruise: 460 + 150 * i, brake: 720 + 220 * i, settle: 140
        }));

        const vmax = 1.32 * CELL;
        const startT = performance.now();
        const span = CELL * (BASE_LEN * 3);
        const finalOffsetFor = i => -CELL * (lands[i] - 1);

        function frame(now) {
            let allDone = true;

            for (let i = 0; i < REELS; i++) {
                const r = reels[i], tm = timings[i];
                const t = Math.max(0, now - startT - tm.delay);
                const total = tm.anticipate + tm.accel + tm.cruise + tm.brake + tm.settle;

                if (t >= total) {
                    const final = finalOffsetFor(i);
                    r.offset = final;
                    r.strip.style.transform = `translateY(${r.offset}px)`;
                    r.strip.style.filter = '';
                    continue;
                }
                allDone = false;

                let dy = 0;
                if (t < tm.anticipate) {
                    const p = t / tm.anticipate; dy = Math.sin(p * Math.PI) * (CELL * 0.12);
                } else if (t < tm.anticipate + tm.accel) {
                    const p = (t - tm.anticipate) / tm.accel; dy = -vmax * (0.3 + 0.7 * p);
                } else if (t < tm.anticipate + tm.accel + tm.cruise) {
                    dy = -vmax;
                } else if (t < tm.anticipate + tm.accel + tm.cruise + tm.brake) {
                    const p = (t - tm.anticipate - tm.accel - tm.cruise) / tm.brake;
                    const target = finalOffsetFor(i);
                    const remaining = target - r.offset;
                    const smooth = p * p * (3 - 2 * p);
                    dy = remaining * 0.16 * (1 - smooth);
                } else {
                    const p = (t - tm.anticipate - tm.accel - tm.cruise - tm.brake) / tm.settle;
                    dy = Math.sin(p * Math.PI) * 6 * (1 - p);
                }

                r.offset += dy;

                if (r.offset < -span) r.offset += span;
                if (r.offset > 0) r.offset -= span;

                const blur = Math.min(3, Math.abs(dy) / CELL * 6);
                r.strip.style.filter = `blur(${blur}px) brightness(${1 + Math.min(.1, Math.abs(dy) / CELL)})`;
                r.strip.style.transform = `translateY(${r.offset}px)`;
            }

            if (!allDone) requestAnimationFrame(frame);
            else finish();
        }

        requestAnimationFrame(frame);

        function finish() {
            reels.forEach(r => r.strip.style.filter = '');
            const centerIdx = reels.map((r, i) => r.order[lands[i]]);

            const { win, count, label, mask } = evaluateWithGaps(centerIdx);

            for (let i = 0; i < REELS; i++) {
                if (mask[i]) {
                    const cell = reels[i].strip.children[lands[i]];
                    if (cell) cell.classList.add('win');
                }
            }

            if (win > 0) {
                updateBalance(win); lastWinEl.textContent = win;
                celebrate(`${count}× ${label}! +${win}`);
            } else {
                lastWinEl.textContent = 0;
                setText(['No booty this time…', 'The chest was empty!', 'Try again, captain.'][Math.floor(Math.random() * 3)]);
            }

            spinning = false;
            spinBtn.disabled = false;
        }
    });

    // ---------- UI helpers ----------
    function updateBalance(d) { balance = Math.max(0, balance + d); balanceEl.textContent = balance; }
    function setText(t) { resultEl.style.color = '#c9f9d0'; resultEl.textContent = t; }
    function celebrate(t) {
        resultEl.style.color = '#a6ffb4'; resultEl.textContent = t;
        resultEl.animate([{ transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.1,1)' });
    }

    // ---------- Evaluator: gaps allowed, wilds substitute, rightmost tie-break ----------
    function evaluateWithGaps(symbolIndices) {
        const arr = symbolIndices.map(i => SYMBOLS[i]);
        const labels = [...new Set(arr.filter(s => !s.wild).map(s => s.name))];

        let bestCount = 0, bestMask = new Array(arr.length).fill(false), bestLabel = 'Any', bestStart = -1;

        for (const label of labels) {
            const mask = new Array(arr.length).fill(false);
            let count = 0, firstIdx = -1;
            for (let i = 0; i < arr.length; i++) {
                const s = arr[i];
                if (s.wild || s.name === label) {
                    mask[i] = true; count++;
                    if (firstIdx === -1) firstIdx = i;
                }
            }
            if (count > bestCount || (count === bestCount && count >= 3 && firstIdx > bestStart)) {
                bestCount = count; bestMask = mask; bestLabel = label; bestStart = firstIdx;
            }
        }

        // All-wilds case
        if (bestCount < 3) {
            const wildMask = new Array(arr.length).fill(false);
            let count = 0, firstIdx = -1;
            for (let i = 0; i < arr.length; i++) if (arr[i].wild) { wildMask[i] = true; count++; if (firstIdx === -1) firstIdx = i; }
            if (count >= 3) { bestCount = count; bestMask = wildMask; bestLabel = 'Any'; bestStart = firstIdx; }
        }

        // Payouts
        let win = 0, payCount = bestCount;
        if (payCount >= 5) win = 20;
        else if (payCount === 4) win = 8;
        else if (payCount === 3) win = 3;
        else { payCount = 0; bestMask = new Array(arr.length).fill(false); }

        return { win, count: payCount, label: bestLabel, mask: bestMask };
    }
})();