// ===== CONFIG =====
const CONFIG = {
    version: 22,                      // bump for update
    autosaveMs: 100,
    startMoney: 0,
    grid: { start: 1, max: 3, expandBase: 1200, expandScale: 2.25 },
    plotUnlock: { base: 300, scale: 1.35 },

    crops: [
        { key: 'wheat', name: 'Wheat', icon: '🌾', unlockCost: 0, harvest: 40, growth: 22, click: 0.03 },
        { key: 'corn', name: 'Corn', icon: '🌽', unlockCost: 500, harvest: 140, growth: 42, click: 0.03 },
        { key: 'apple', name: 'Apples', icon: '🍎', unlockCost: 1500, harvest: 420, growth: 70, click: 0.03 },
        { key: 'grape', name: 'Grapes', icon: '🍇', unlockCost: 4000, harvest: 1400, growth: 110, click: 0.03 },
        { key: 'pump', name: 'Pumpkins', icon: '🎃', unlockCost: 10000, harvest: 4200, growth: 160, click: 0.03 },
    ],

    // Cheaper upgrade prices (kept from last change)
    upgrades: [
        { key: 'tractor', title: 'Tractor', icon: '🚜', type: 'growth', step: 0.12, baseCost: 50, scale: 1.28, prereq: s => ownedCount() >= 1 },
        { key: 'farmhands', title: 'Farmhands', icon: '🧑‍🌾', type: 'click', step: 0.2, baseCost: 10, scale: 1.3, prereq: s => ownedCount() >= 1 },
        { key: 'sprinkler', title: 'Sprinkler', icon: '💧', type: 'growth', step: 0.18, baseCost: 100, scale: 1.30, prereq: s => s.totalEarned >= 2000 },
        { key: 'barn', title: 'Barn', icon: '🏚️', type: 'harvest', step: 0.20, baseCost: 400, scale: 1.30, prereq: s => ownedCount() >= 2 },
        { key: 'fertilizer', title: 'Fertilizer', icon: '🧪', type: 'harvest', step: 0.15, baseCost: 220, scale: 1.28, prereq: s => s.totalEarned >= 1500 },
        { key: 'plow', title: 'Plow', icon: '🛠️', type: 'growth', step: 0.10, baseCost: 260, scale: 1.27, prereq: s => ownedCount() >= 1 },
        { key: 'greenhouse', title: 'Greenhouse', icon: '🏡', type: 'growth', step: 0.20, baseCost: 600, scale: 1.32, prereq: s => ownedCount() >= 3 || s.totalEarned >= 8000 },
        { key: 'composter', title: 'Composter', icon: '♻️', type: 'harvest', step: 0.12, baseCost: 400, scale: 1.29, prereq: s => s.totalEarned >= 4000 },
    ],
};

// ===== STATE & SAVE =====
const SAVE_KEY = 'FARM_EXT_JS_V' + CONFIG.version;
const DEFAULT = () => ({
    money: CONFIG.startMoney, totalEarned: 0, totalClicks: 0, totalHarvests: 0,
    gridSize: CONFIG.grid.start, plots: [], cropsUnlocked: 1, assignMode: null,
    upgrades: Object.fromEntries(CONFIG.upgrades.map(u => [u.key, 0])),
    seenIntro: false
});
let S = DEFAULT();

function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }
function load() {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
    try { S = Object.assign(DEFAULT(), JSON.parse(raw)); ensurePlots(); return true; } catch { return false; }
}
function hardReset() { S = DEFAULT(); ensurePlots(); renderAll(); save(); showIntro(true); }

// ===== UTILS =====
const $ = s => document.querySelector(s), el = id => document.getElementById(id);
const fmt = n => (n >= 1e12) ? (n / 1e12).toFixed(2) + 'T' : (n >= 1e9) ? (n / 1e9).toFixed(2) + 'B' : (n >= 1e6) ? (n / 1e6).toFixed(2) + 'M' : (n >= 1e3) ? (n / 1e3).toFixed(2) + 'k' : n.toFixed(0);
const cropByKey = k => CONFIG.crops.find(c => c.key === k);
const ownedCount = () => S.plots.filter(p => p.owned).length;

// ===== PLOTS =====
function ensurePlots() {
    const N = CONFIG.grid.max * CONFIG.grid.max;
    if (!S.plots.length) {
        for (let i = 0; i < N; i++) { const owned = (i === 0); S.plots.push({ owned, crop: owned ? 'wheat' : null, progress: 0 }); }
    } else if (S.plots.length < N) {
        for (let i = S.plots.length; i < N; i++) S.plots.push({ owned: false, crop: null, progress: 0 });
    }
}

// ===== ECONOMY =====
function globalGrowthMult() { return 1 + CONFIG.upgrades.filter(u => u.type === 'growth').reduce((a, u) => a + (S.upgrades[u.key] || 0) * u.step, 0); }
function globalHarvestMult() { return 1 + CONFIG.upgrades.filter(u => u.type === 'harvest').reduce((a, u) => a + (S.upgrades[u.key] || 0) * u.step, 0); }
function globalClickMult() { return 1 + CONFIG.upgrades.filter(u => u.type === 'click').reduce((a, u) => a + (S.upgrades[u.key] || 0) * u.step, 0); }
function effectiveGrowthSec(p) { if (!p.crop) return Infinity; const c = cropByKey(p.crop); return c.growth / globalGrowthMult(); }
function harvestValue(p) { if (!p.crop) return 0; const c = cropByKey(p.crop); return c.harvest * globalHarvestMult(); }
function clickBonus(p) {
    if (!p.crop) return 0;
    const c = cropByKey(p.crop);
    const base = harvestValue(p) * c.click;
    return Math.max(1, Math.floor(base * globalClickMult()));
}
function coinsPerSec() {
    let s = 0;
    for (const p of S.plots) {
        if (!p.owned || !p.crop) continue;
        const T = effectiveGrowthSec(p);
        if (isFinite(T) && T > 0) s += harvestValue(p) / T;
    }
    return s;
}
function plotUnlockCost() { const n = ownedCount(); return Math.floor(CONFIG.plotUnlock.base * Math.pow(CONFIG.plotUnlock.scale, Math.max(0, n - 1))); }

// ===== MONEY =====
function addMoney(x) { if (x > 0) { S.money += x; S.totalEarned += x; } }
function spend(x) { if (S.money >= x) { S.money -= x; return true; } return false; }

// ===== DOM =====
const elFarm = el('farm'), elMoney = el('money'), elCps = el('cps');
const btnReset = el('btnReset'), btnHowTo = el('btnHowTo');
const introOverlay = el('intro'), introOk = el('introOk'), assignOverlay = el('assignHint'), assignOk = el('assignOk'), assignText = el('assignText');

// ===== MODALS =====
function showIntro(force = false) { if (force || !S.seenIntro) introOverlay.classList.remove('hidden'); }
function hideIntro() { introOverlay.classList.add('hidden'); S.seenIntro = true; save(); }
function showAssignHint(name) { assignText.textContent = `Click a field on the Farm tab to assign ${name}.`; assignOverlay.classList.remove('hidden'); }
function hideAssignHint() { assignOverlay.classList.add('hidden'); }

// ===== HUD =====
function renderHUD() { elMoney.textContent = fmt(S.money); const cps = coinsPerSec(); elCps.textContent = (cps < 1000) ? cps.toFixed(1) : fmt(cps); }

// ===== GRID =====
function rebuildGrid() {
    const n = S.gridSize;
    elFarm.style.gridTemplateColumns = `repeat(${n},1fr)`;
    elFarm.classList.toggle('one', n === 1);
    elFarm.innerHTML = '';

    // Decide icon grid density: 3×3 only when full 3×3 farm grid; else 5×5
    const cellCount = (n === 3) ? 9 : 25;
    const gridTemplate = (n === 3) ? 'repeat(3,1fr)' : 'repeat(5,1fr)';

    for (let idx = 0; idx < CONFIG.grid.max * CONFIG.grid.max; idx++) {
        const r = Math.floor(idx / CONFIG.grid.max), c = idx % CONFIG.grid.max;
        if (r >= n || c >= n) continue;

        const p = S.plots[idx], tile = document.createElement('div');
        tile.className = 'plot ' + (p.owned ? 'owned' : 'locked');
        tile.dataset.idx = idx;

        if (p.owned) {
            const meta = document.createElement('div'); meta.className = 'meta';
            const b = document.createElement('div'); b.className = 'badge'; b.textContent = p.crop ? cropByKey(p.crop).name : 'Empty'; meta.appendChild(b);

            const content = document.createElement('div'); content.className = 'content';
            content.style.gridTemplateColumns = gridTemplate;
            content.style.gridTemplateRows = gridTemplate;

            const icon = p.crop ? cropByKey(p.crop).icon : '🌱';
            for (let i = 0; i < cellCount; i++) {
                const s = document.createElement('div'); s.className = 'sprout'; s.textContent = icon; content.appendChild(s);
            }

            const prog = document.createElement('div'); prog.className = 'progress'; const fill = document.createElement('div'); fill.className = 'fill'; prog.appendChild(fill);
            tile.appendChild(meta); tile.appendChild(content); tile.appendChild(prog);
            tile.addEventListener('click', e => onPlotClickOwned(idx, e));
        } else {
            const price = document.createElement('div'); price.className = 'lock-price';
            price.innerHTML = `<span class="money-tag small">Money</span>${fmt(plotUnlockCost())}<br/>Unlock`;
            tile.appendChild(price);
            tile.addEventListener('click', () => tryUnlockPlot(idx));
        }
        elFarm.appendChild(tile);
    }
}

function updateGridDynamic(dt) {
    const tiles = [...elFarm.querySelectorAll('.plot.owned')];
    tiles.forEach(tile => {
        const idx = +tile.dataset.idx, p = S.plots[idx]; if (!p) return;
        const T = effectiveGrowthSec(p);
        if (p.crop && isFinite(T) && T > 0) {
            p.progress += dt / T;
            while (p.progress >= 1) {
                p.progress -= 1;
                const reward = Math.floor(harvestValue(p));
                addMoney(reward);
                S.totalHarvests++;

                // Float text on harvest (center of tile)
                const span = document.createElement('div');
                span.className = 'float';
                span.style.left = (tile.clientWidth / 2) + 'px';
                span.style.top = (tile.clientHeight / 2) + 'px';
                span.textContent = '+ ' + fmt(reward);
                tile.appendChild(span);
                setTimeout(() => span.remove(), 900);
            }
        }

        // Update badge
        const badge = tile.querySelector('.badge'); if (badge) badge.textContent = p.crop ? cropByKey(p.crop).name : 'Empty';

        // === New continuous growth animation ===
        const content = tile.querySelector('.content');
        if (content) {
            const sprouts = [...content.children];
            const f = (p.progress % 1);                  // 0 → 1
            const icon = p.crop ? cropByKey(p.crop).icon : '🌱';

            // density activation (matches 3×3 or 5×5)
            const total = sprouts.length;
            const active = Math.min(total, Math.max(0, Math.floor(f * total)));

            // Scale grows from 0.65 → 1.10 as it matures; opacity 0.35 → 1
            const scale = 0.65 + 1 * f;
            const alpha = 0.35 + 0.65 * f;

            sprouts.forEach((s, i) => {
                s.textContent = icon;
                s.style.transform = `scale(${scale})`;
                s.style.opacity = (i < active) ? alpha.toFixed(2) : 0.15;  // inactive are faint
            });
        }

        // progress bar
        const fill = tile.querySelector('.fill'); if (fill) fill.style.width = Math.min(100, (p.progress % 1) * 100) + '%';
    });
}

// ===== INTERACTIONS =====
function tryUnlockPlot(idx) {
    const p = S.plots[idx]; if (p.owned) return;
    const cost = plotUnlockCost();
    if (spend(cost)) { p.owned = true; if (!p.crop) p.crop = 'wheat'; p.progress = 0; rebuildGrid(); renderHUD(); save(); }
}
function onPlotClickOwned(idx, e) {
    const p = S.plots[idx], tile = e.currentTarget;

    // If in assign mode: assign and EXIT mode immediately
    if (S.assignMode) {
        p.crop = S.assignMode;
        p.progress = 0;
        S.assignMode = null;           // <-- exit assign mode
        hideAssignHint();              // hide the hint overlay
        renderCropsTab();
        save();
        return;
    }

    // Normal click bonus
    const bonus = clickBonus(p); addMoney(bonus); S.totalClicks++;
    const rect = tile.getBoundingClientRect(); const span = document.createElement('div');
    span.className = 'float'; span.style.left = (e.clientX - rect.left) + 'px'; span.style.top = (e.clientY - rect.top) + 'px'; span.textContent = '+ ' + fmt(bonus);
    tile.appendChild(span); setTimeout(() => span.remove(), 900);
    tile.style.transform = 'scale(.985)'; setTimeout(() => tile.style.transform = 'scale(1)', 70);
    renderHUD();
}

// ===== CROPS =====
function renderCropsTab() {
    const list = document.getElementById('list-crops'); list.innerHTML = '';
    CONFIG.crops.forEach((c, idx) => {
        const unlocked = idx < S.cropsUnlocked, canAff = S.money >= c.unlockCost;
        const row = document.createElement('div'); row.className = 'item';
        row.innerHTML = `
      <div class="icon">${c.icon}</div>
      <div>
        <div class="title">${c.name} ${unlocked ? '' : '<span class="badge locked">Locked</span>'}</div>
        <div class="sub">Harvest +${c.harvest}, Growth ${c.growth}s, Click ≈ ${Math.round(c.click * 100)}%</div>
      </div>
      <div>
        ${idx === 0
                ? `<button ${S.assignMode === 'wheat' ? 'class="afford"' : ''} data-assign="${c.key}">Assign</button>`
                : unlocked
                    ? `<button ${S.assignMode === c.key ? 'class="afford"' : ''} data-assign="${c.key}">Assign</button>`
                    : `<button ${canAff ? 'class="afford"' : ''} data-unlock="${idx}"><span class="money-tag small">Money</span>${fmt(c.unlockCost)}</button>`
            }
      </div>`;
        list.appendChild(row);
    });
    list.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-unlock')) {
            const i = +b.dataset.unlock, cost = CONFIG.crops[i].unlockCost;
            if (spend(cost)) { S.cropsUnlocked = Math.max(S.cropsUnlocked, i + 1); renderCropsTab(); renderHUD(); save(); }
            return;
        }
        if (b.hasAttribute('data-assign')) {
            const key = b.dataset.assign;
            // Toggle assign mode; show hint when entering
            if (S.assignMode === key) { S.assignMode = null; hideAssignHint(); }
            else { S.assignMode = key; showAssignHint(`“${cropByKey(key).name}”`); }
            renderCropsTab();
        }
    };
}

// ===== UPGRADES =====
function upgradeCost(u) { const lvl = S.upgrades[u.key] || 0; return Math.floor(u.baseCost * Math.pow(u.scale, lvl)); }
function expandFarmCost() { const steps = Math.max(0, S.gridSize - CONFIG.grid.start); return Math.floor(CONFIG.grid.expandBase * Math.pow(CONFIG.grid.expandScale, steps)); }

function renderUpgradesTab() {
    const list = document.getElementById('list-upgrades'); list.innerHTML = '';

    // Expand farm
    const canExpand = S.gridSize < CONFIG.grid.max, exCost = expandFarmCost();
    const expand = document.createElement('div'); expand.className = 'item';
    expand.innerHTML = `
    <div class="icon">🧱</div>
    <div>
      <div class="title">Expand Farms <span class="sub">Current ${S.gridSize}×${S.gridSize}</span></div>
      <div class="sub">Reveals more plot slots (max ${CONFIG.grid.max}×${CONFIG.grid.max}). New plots appear locked; unlock each on its tile.</div>
    </div>
    <div>${canExpand ? `<button class="${S.money >= exCost ? 'afford' : ''}" data-expand><span class="money-tag small">Money</span>${fmt(exCost)}</button>` : `<button disabled>Max</button>`}</div>`;
    list.appendChild(expand);

    // Upgrades
    CONFIG.upgrades.forEach(u => {
        const lvl = S.upgrades[u.key] || 0, cost = upgradeCost(u), canAff = S.money >= cost, meets = u.prereq(S);
        const effect = (u.type === 'growth')
            ? `Next: +${(u.step * 100).toFixed(0)}% growth speed`
            : (u.type === 'harvest')
                ? `Next: +${(u.step * 100).toFixed(0)}% harvest value`
                : `Next: +${(u.step * 100).toFixed(0)}% click bonus`;
        const row = document.createElement('div'); row.className = 'item';
        row.innerHTML = `
      <div class="icon">${u.icon}</div>
      <div>
        <div class="title">${u.title} <span class="sub">Lv ${lvl}</span> ${meets ? '' : '<span class="badge locked">Locked</span>'}</div>
        <div class="sub">${effect}</div>
      </div>
      <div>
        <button ${(canAff && meets) ? 'class="afford"' : ''} data-up="${u.key}" ${meets ? '' : 'disabled'}>
          <span class="money-tag small">Money</span>${fmt(cost)}
        </button>
      </div>`;
        list.appendChild(row);
    });

    list.onclick = e => {
        const btn = e.target.closest('button'); if (!btn) return;
        if (btn.hasAttribute('data-expand')) {
            if (S.gridSize < CONFIG.grid.max) { const c = expandFarmCost(); if (spend(c)) { S.gridSize++; rebuildGrid(); renderUpgradesTab(); renderHUD(); save(); } }
            return;
        }
        if (btn.hasAttribute('data-up')) {
            const key = btn.dataset.up, u = CONFIG.upgrades.find(x => x.key === key); if (!u) return;
            const c = upgradeCost(u); if (u.prereq(S) && spend(c)) { S.upgrades[key] = (S.upgrades[key] || 0) + 1; renderUpgradesTab(); renderHUD(); save(); }
        }
    };
}

// ===== TABS =====
document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        el('panel-farm').classList.toggle('hidden', tab !== 'farm');
        el('panel-crops').classList.toggle('hidden', tab !== 'crops');
        el('panel-upgrades').classList.toggle('hidden', tab !== 'upgrades');
    });
});

// ===== LOOP =====
let lastT = performance.now();
function frame(t) {
    const dt = Math.min(0.15, (t - lastT) / 1000); lastT = t;
    updateGridDynamic(dt); renderHUD();
    requestAnimationFrame(frame);
}

// ===== INIT =====
function renderAll() { renderHUD(); rebuildGrid(); renderCropsTab(); renderUpgradesTab(); }
function init() {
    ensurePlots(); renderAll();

    el('btnReset').addEventListener('click', hardReset);
    el('btnHowTo').addEventListener('click', () => showIntro(true));
    el('introOk').addEventListener('click', hideIntro);
    el('assignOk').addEventListener('click', hideAssignHint);

    // marketing "Fullscreen"
    el('fullscreen')?.addEventListener('click', () => {
        try {
            if (chrome?.tabs?.create) { chrome.tabs.create({ url: "https://arcadebytom.com/play.html?g=blackjack" }); window.close(); }
            else window.open("https://arcadebytom.com/play.html?g=blackjack", "_blank");
        } catch { window.open("https://arcadebytom.com/play.html?g=blackjack", "_blank"); }
    });

    setInterval(save, CONFIG.autosaveMs);
    window.addEventListener('beforeunload', save);

    requestAnimationFrame(frame);
    showIntro(false);
}
if (!load()) ensurePlots();
init();
