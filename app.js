(() => {
  'use strict';

  /* =========================================================
   * Pixel icons — tiny bitmaps drawn as crisp SVG
   * ========================================================= */
  const PAL = {
    k: '#2b1d1a', w: '#ffffff', b: '#6fb0dc', B: '#4a86b8', l: '#bfe6f5',
    r: '#e0585a', R: '#b23a3e', y: '#ffd84a', Y: '#e8b520', n: '#9a6438',
    N: '#5e3a22', c: '#e2a95c', p: '#f7b3c2', P: '#e38aa0', g: '#79b765',
  };

  const ICONS = {
    fish: [
      '...kkkk.....',
      '.kkbbbbkk..k',
      'kbwkbbbbbkbk',
      'kbbbbbbbbbbk',
      'kBBBBBBBBkBk',
      '.kkBBBBkk..k',
      '...kkkk.....',
    ],
    heart: [
      '.kk...kk.',
      'krrk.krrk',
      'krwrkrrrk',
      'krrrrrrrk',
      '.krrrrRk.',
      '..krrRk..',
      '...kRk...',
      '....k....',
    ],
    bolt: [
      '....kkkk',
      '...kyyyk',
      '..kyyyk.',
      '.kyyyk..',
      'kyyyyyyk',
      'kkkyyyk.',
      '..kyyk..',
      '.kyYk...',
      '.kYk....',
      '.kk.....',
    ],
    drop: [
      '...k...',
      '..kbk..',
      '..kbk..',
      '.kbbbk.',
      'kblbbbk',
      'kblbbbk',
      'kbbbbBk',
      '.kBBBk.',
      '..kkk..',
    ],
    cookie: [
      '..kkkk..',
      '.kccNck.',
      'kcccccck',
      'kcNcccNk',
      'kccccNck',
      'kcNcccck',
      '.kcccck.',
      '..kkkk..',
    ],
    yarn: [
      '..kkkkk...',
      '.krrRrrk..',
      'krrRrrRrk.',
      'kRrrRrrRk.',
      'krRrrRrrk.',
      'krrRrrRrk.',
      'kRrrRrrRk.',
      '.krrrRrk..',
      '..kkkkkkkk',
    ],
    soap: [
      '..ll...l..',
      '.l..l.l.l.',
      '..ll...l..',
      '.kkkkkkkk.',
      'kppppppppk',
      'kpwppppppk',
      'kpppppppPk',
      '.kkkkkkkk.',
    ],
    moon: [
      '..kkkk..',
      '.kyyk...',
      'kyyk....',
      'kyyk....',
      'kyyk...k',
      'kyyyk.kk',
      '.kyyykk.',
      '..kkkk..',
    ],
    sun: [
      '....y....',
      '.y.....y.',
      '...kkk...',
      '..kyyyk..',
      'y.kyyyk.y',
      '..kyyYk..',
      '...kkk...',
      '.y.....y.',
      '....y....',
    ],
    pill: [
      '.kkkkkkkk.',
      'krwrrkwwwk',
      'krrrrkwwwk',
      'kRrrrklllk',
      '.kkkkkkkk.',
    ],
    poop: [
      '....kk....',
      '...knnk...',
      '...knnnk..',
      '..kkkkkkk.',
      '.knnnnnnnk',
      '.knnnnnNnk',
      'kkkkkkkkkk',
      'knnnnnnnnk',
      'knNnnnnNnk',
      'kkkkkkkkkk',
    ],
    thermo: [
      '.kkk.',
      '.kwk.',
      '.kwk.',
      '.krk.',
      '.krk.',
      '.krk.',
      'kkrkk',
      'krrrk',
      'krRrk',
      '.kkk.',
    ],
  };

  const svgCache = {};
  function icon(name) {
    if (svgCache[name]) return svgCache[name];
    const rows = ICONS[name];
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    let rects = '';
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (PAL[ch]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL[ch]}"/>`;
      });
    });
    return (svgCache[name] =
      `<svg class="px" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${rects}</svg>`);
  }
  function paintIcons(root = document) {
    root.querySelectorAll('i[data-icon]').forEach((el) => {
      el.innerHTML = icon(el.dataset.icon);
    });
  }

  /* =========================================================
   * State & simulation
   * ========================================================= */
  const SAVE_KEY = 'brotato.save.v1';
  const MAX_AWAY_MIN = 72 * 60; // simulate at most 3 days away
  // Dev helper: add ?speed=60 to the URL to run time 60x faster.
  const SPEED = Math.max(1, Number(new URLSearchParams(location.search).get('speed')) || 1);

  // Change per real hour.
  const RATES = {
    awake: { hunger: -9, fun: -11, energy: -7, clean: -4 },
    asleep: { hunger: -4, fun: -2, energy: 25, clean: -1 },
  };
  const STATS = ['hunger', 'fun', 'energy', 'clean'];

  const fresh = () => ({
    v: 1,
    name: 'Brotato',
    named: false,
    born: Date.now(),
    last: Date.now(),
    hunger: 75,
    fun: 80,
    energy: 90,
    clean: 100,
    poops: 0,
    poopIn: null, // sim minutes until the next poop
    sick: false,
    asleep: false,
    snacks: [],
  });

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return Object.assign(fresh(), JSON.parse(raw));
    } catch (_) { /* storage blocked or corrupt — start fresh */ }
    return fresh();
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (_) { /* ignore */ }
  }

  const S = load();
  const clamp = (v) => Math.max(0, Math.min(100, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Advance the world by `m` simulated minutes. Returns events that happened.
  function step(m, events) {
    const h = m / 60;
    const r = S.asleep ? RATES.asleep : RATES.awake;
    const sickMul = S.sick ? 1.5 : 1;

    S.hunger = clamp(S.hunger + r.hunger * h * sickMul);
    S.fun = clamp(S.fun + (r.fun - S.poops * 2) * h * sickMul);
    S.energy = clamp(S.energy + (S.asleep ? r.energy * (S.sick ? 0.5 : 1) : r.energy * sickMul) * h);
    S.clean = clamp(S.clean + (r.clean - S.poops * 6) * h);

    if (S.poopIn != null) {
      S.poopIn -= m;
      if (S.poopIn <= 0) {
        S.poopIn = null;
        if (S.poops < 4) { S.poops++; events.add('poop'); }
      }
    }

    if (!S.sick) {
      let risk = 0;
      if (S.poops >= 2) risk += 0.0015 * S.poops;
      if (S.hunger < 10) risk += 0.002;
      if (S.clean < 10) risk += 0.002;
      if (S.fun < 5) risk += 0.001;
      if (risk && Math.random() < risk * m) { S.sick = true; events.add('sick'); }
    }

    if (S.asleep && S.energy >= 100) { S.asleep = false; events.add('woke'); }
    if (!S.asleep && S.energy <= 0) { S.asleep = true; events.add('passout'); }
  }

  function advance(now = Date.now()) {
    let mins = Math.min(((now - S.last) / 60000) * SPEED, MAX_AWAY_MIN);
    S.last = now;
    const events = new Set();
    while (mins > 0) {
      const m = Math.min(1, mins);
      step(m, events);
      mins -= m;
    }
    return events;
  }

  /* =========================================================
   * DOM
   * ========================================================= */
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const pet = $('pet');
  const speechEl = $('speech');
  const fx = $('fx');
  const poopsEl = $('poops');
  const feedMenu = $('feedMenu');
  const btn = {
    feed: $('btnFeed'), play: $('btnPlay'), clean: $('btnClean'),
    sleep: $('btnSleep'), meds: $('btnMeds'),
  };

  let busy = false; // an animation / mini game is running

  // Build stat bars once
  const bars = {};
  document.querySelectorAll('.stat').forEach((el) => {
    const bar = el.querySelector('.bar');
    bar.innerHTML = '<b></b>'.repeat(10);
    bars[el.dataset.stat] = { el, cells: [...bar.children] };
  });

  /* ---------- speech ---------- */
  let speechTimer = 0;
  let lastSpoke = 0;
  function say(text, ms = 2600) {
    speechEl.textContent = text;
    speechEl.classList.add('show');
    lastSpoke = Date.now();
    clearTimeout(speechTimer);
    speechTimer = setTimeout(() => speechEl.classList.remove('show'), ms);
  }

  function needLine() {
    if (S.sick) return pick(["I don't feel so good...", '*cough cough*', 'Medicine... please?']);
    if (S.poops >= 2) return pick(['Ew, it stinks in here!', 'Could you tidy up?']);
    if (S.hunger < 30) return pick(["I'm hungry...", 'Is it dinner time?', 'Fish? Fish!']);
    if (S.energy < 25) return pick(['*yaaawn*', 'So sleepy...']);
    if (S.fun < 30) return pick(["I'm bored...", 'Play with me!']);
    if (S.clean < 30) return pick(['I feel grubby.', 'My fur is a mess.']);
    return null;
  }
  const HAPPY_LINES = ['Nya~', 'Purrr...', 'Like my hat?', '*stretches*', 'Meow!', 'Life is good.', '*kneads the floor*'];

  /* ---------- effects ---------- */
  function particle(name, x, y) {
    const el = document.createElement('span');
    el.className = 'particle';
    el.innerHTML = icon(name);
    el.style.left = `${x - 13}px`;
    el.style.top = `${y - 13}px`;
    el.style.setProperty('--dx', `${rand(-30, 30)}px`);
    fx.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
  function hearts(n = 3) {
    const r = pet.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      setTimeout(() => particle('heart', r.left - s.left + r.width * rand(0.3, 0.7), r.top - s.top + r.height * 0.3), i * 140);
    }
  }
  function bubbles(n = 18) {
    const s = stage.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const b = document.createElement('span');
        b.className = 'bubble';
        b.style.left = `${rand(0.1, 0.85) * s.width}px`;
        b.style.top = `${rand(0.55, 0.9) * s.height}px`;
        fx.appendChild(b);
        setTimeout(() => b.remove(), 1500);
      }, i * 60);
    }
  }
  function flash(cls, ms) {
    pet.classList.add(cls);
    setTimeout(() => pet.classList.remove(cls), ms);
  }

  /* ---------- blinking ---------- */
  (function blinkLoop() {
    setTimeout(() => {
      if (!S.asleep) {
        pet.classList.add('blink');
        setTimeout(() => pet.classList.remove('blink'), 140);
      }
      blinkLoop();
    }, rand(2200, 5200));
  })();

  /* ---------- render ---------- */
  const POOP_SPOTS = [12, 74, 4, 84];
  function renderPoops() {
    if (poopsEl.childElementCount === S.poops) return;
    poopsEl.classList.remove('cleaning');
    poopsEl.innerHTML = '';
    for (let i = 0; i < S.poops; i++) {
      const p = document.createElement('span');
      p.className = 'poop';
      p.style.left = `${POOP_SPOTS[i]}%`;
      p.innerHTML = icon('poop');
      poopsEl.appendChild(p);
    }
  }

  function render() {
    for (const k of STATS) {
      const v = S[k];
      const on = Math.ceil(v / 10);
      const { el, cells } = bars[k];
      cells.forEach((c, i) => c.classList.toggle('off', i >= on));
      el.classList.toggle('low', v < 25);
      el.classList.toggle('mid', v >= 25 && v < 50);
      el.setAttribute('aria-label', `${el.querySelector('.label').textContent} ${Math.round(v)}%`);
    }

    const sad = !S.sick && !S.asleep && STATS.some((k) => S[k] < 25);
    pet.classList.toggle('is-sleeping', S.asleep);
    pet.classList.toggle('is-sick', S.sick && !S.asleep);
    pet.classList.toggle('is-sad', sad);
    stage.classList.toggle('lights-off', S.asleep);

    // floating status icon over the cat's head
    let status = '';
    if (S.sick) status = 'thermo';
    else if (!S.asleep) {
      const low = STATS.filter((k) => S[k] < 25).sort((a, b) => S[a] - S[b])[0];
      status = { hunger: 'fish', fun: 'heart', energy: 'bolt', clean: 'drop' }[low] || '';
    }
    const iconEl = $('statusIcon');
    if (iconEl.dataset.icon !== status) {
      iconEl.dataset.icon = status;
      iconEl.innerHTML = status ? icon(status) : '';
    }

    renderPoops();

    // buttons
    btn.meds.hidden = !S.sick;
    btn.sleep.querySelector('span').textContent = S.asleep ? 'Wake' : 'Sleep';
    const sleepIcon = S.asleep ? 'sun' : 'moon';
    const si = btn.sleep.querySelector('i');
    if (si.dataset.icon !== sleepIcon) { si.dataset.icon = sleepIcon; si.innerHTML = icon(sleepIcon); }
    btn.feed.disabled = btn.play.disabled = btn.clean.disabled = S.asleep || busy;
    btn.sleep.disabled = btn.meds.disabled = busy;

    // header
    const days = Math.floor((Date.now() - S.born) * SPEED / 86400000) + 1;
    $('age').textContent = `Day ${days}`;
    $('name').textContent = S.name;
    const now = new Date();
    $('clock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const hr = now.getHours();
    stage.classList.toggle('night', hr >= 20 || hr < 7);
  }

  /* ---------- game loop ---------- */
  function handleEvents(events) {
    if (events.has('sick')) say("I don't feel so good...", 3500);
    else if (events.has('passout')) say('*flops over* ...zzz', 3000);
    else if (events.has('woke')) { say('*stretch* Good morning!'); flash('is-happy', 1300); }
    else if (events.has('poop')) say(pick(['Oops...', 'Uh oh.', "Wasn't me!"]));
  }

  let lastSave = 0;
  function tick() {
    handleEvents(advance());
    render();
    if (Date.now() - lastSave > 5000) { save(); lastSave = Date.now(); }

    // idle chatter
    if (!busy && !S.asleep && Date.now() - lastSpoke > rand(14000, 26000)) {
      say(needLine() || pick(HAPPY_LINES));
    }
  }

  /* =========================================================
   * Actions
   * ========================================================= */
  function act(fn) {
    return (e) => {
      if (busy && fn !== doMeds) return;
      fn(e);
      render();
      save();
    };
  }

  function sleepingReply() { say(pick(['Zzz...', '*snore*', '...mrrp (still sleeping)'])); }

  // Feed
  function toggleFeed() {
    if (S.asleep) return sleepingReply();
    feedMenu.hidden = !feedMenu.hidden;
  }
  function eat(food) {
    feedMenu.hidden = true;
    if (food === 'cancel') return;
    if (food === 'meal' && S.hunger > 90) return say("I'm stuffed!");
    const hourAgo = Date.now() - 3600000 / SPEED;
    S.snacks = S.snacks.filter((t) => t > hourAgo);
    if (food === 'snack' && S.snacks.length >= 3) return say('No more treats... tummy ache.');

    busy = true;
    const plate = document.createElement('span');
    plate.className = 'food';
    plate.innerHTML = icon(food === 'meal' ? 'fish' : 'cookie');
    stage.appendChild(plate);
    pet.classList.add('is-eating');
    say(food === 'meal' ? 'Nom nom nom!' : 'A treat!? Yay!', 1800);

    setTimeout(() => {
      plate.remove();
      pet.classList.remove('is-eating');
      advance();
      if (food === 'meal') {
        S.hunger = clamp(S.hunger + 35);
        S.clean = clamp(S.clean - 3);
        if (S.poopIn == null) S.poopIn = rand(45, 120);
      } else {
        S.hunger = clamp(S.hunger + 8);
        S.fun = clamp(S.fun + 12);
        S.snacks.push(Date.now());
      }
      busy = false;
      flash('is-happy', 1300);
      hearts(2);
      render();
      save();
    }, 1800);
  }

  // Play — catch the yarn ball
  const yarn = $('yarn');
  const hud = $('gameHud');
  let game = null;

  function startPlay() {
    if (S.asleep) return sleepingReply();
    if (S.sick) return say('Too sick to play...');
    if (S.energy < 15) return say('Too tired... maybe later.');
    feedMenu.hidden = true;
    busy = true;
    game = { score: 0, time: 12 };
    $('gameScore').textContent = '0';
    $('gameTime').textContent = String(game.time);
    yarn.innerHTML = icon('yarn');
    hud.hidden = false;
    stage.classList.add('playing');
    yarn.hidden = false;
    moveYarn();
    game.mover = setInterval(moveYarn, 950);
    game.timer = setInterval(() => {
      game.time--;
      $('gameTime').textContent = String(game.time);
      if (game.time <= 0) endPlay();
    }, 1000);
    say('Catch it! Catch it!', 1500);
  }
  function moveYarn() {
    const s = stage.getBoundingClientRect();
    yarn.style.left = `${rand(0.04, 0.82) * s.width}px`;
    yarn.style.top = `${rand(0.2, 0.72) * s.height}px`;
  }
  yarn.addEventListener('pointerdown', (e) => {
    if (!game) return;
    e.preventDefault();
    game.score++;
    $('gameScore').textContent = String(game.score);
    S.fun = clamp(S.fun + 5);
    S.energy = clamp(S.energy - 1.5);
    S.hunger = clamp(S.hunger - 1);
    const s = stage.getBoundingClientRect();
    const r = yarn.getBoundingClientRect();
    particle('heart', r.left - s.left + r.width / 2, r.top - s.top);
    moveYarn();
    render();
  });
  function endPlay() {
    clearInterval(game.mover);
    clearInterval(game.timer);
    const { score } = game;
    game = null;
    yarn.hidden = true;
    hud.hidden = true;
    stage.classList.remove('playing');
    busy = false;
    if (score >= 8) { say(`${score} catches! You're the best!`); hearts(4); }
    else if (score > 0) say(`Caught ${score}! Fun!`);
    else say('Aww, it got away...');
    flash('is-happy', 1300);
    render();
    save();
  }

  // Clean
  function doClean() {
    if (S.asleep) return sleepingReply();
    if (S.poops === 0 && S.clean > 90) return say('Already squeaky clean!');
    feedMenu.hidden = true;
    busy = true;
    const hadPoop = S.poops > 0;
    bubbles();
    poopsEl.classList.add('cleaning');
    setTimeout(() => {
      advance();
      S.poops = 0;
      S.clean = 100;
      if (!hadPoop) { S.fun = clamp(S.fun - 4); say('Hmph. A bath?!'); }
      else { say('Ahh, much better!'); flash('is-happy', 1300); }
      busy = false;
      render();
      save();
    }, 900);
  }

  // Sleep / wake
  function toggleSleep() {
    feedMenu.hidden = true;
    if (S.asleep) {
      S.asleep = false;
      if (S.energy < 50) { S.fun = clamp(S.fun - 10); say('Grrr... too early!'); }
      else say('*stretch* Morning!');
      return;
    }
    if (S.energy > 85) return say('Not sleepy!');
    S.asleep = true;
    say('Goodnight...', 1800);
  }

  // Medicine
  function doMeds() {
    if (!S.sick) return;
    S.sick = false;
    S.fun = clamp(S.fun - 5);
    say('Bleh! ...but I feel better.');
  }

  // Petting
  let lastPet = 0;
  function petCat() {
    if (game) return;
    feedMenu.hidden = true;
    if (S.asleep) return sleepingReply();
    hearts(S.sick ? 1 : 3);
    if (Date.now() - lastPet > 1200) {
      S.fun = clamp(S.fun + 4);
      lastPet = Date.now();
    }
    say(S.sick ? 'Purr... (weakly)' : pick(['Purrrr~', 'Mrrp!', '*headbutt*', 'More pets!']), 1500);
    if (!S.sick && Math.random() < 0.4) flash('is-happy', 1300);
  }

  btn.feed.addEventListener('click', act(toggleFeed));
  feedMenu.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-food]');
    if (b) { eat(b.dataset.food); render(); }
  });
  btn.play.addEventListener('click', act(startPlay));
  btn.clean.addEventListener('click', act(doClean));
  btn.sleep.addEventListener('click', act(toggleSleep));
  btn.meds.addEventListener('click', act(doMeds));
  pet.addEventListener('click', act(petCat));

  /* ---------- naming ---------- */
  const dialog = $('nameDialog');
  const nameInput = $('nameInput');
  function askName() {
    nameInput.value = S.name;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else {
      const n = prompt('Name your cat', S.name);
      if (n) { S.name = n.trim().slice(0, 14) || S.name; S.named = true; save(); render(); }
    }
  }
  dialog.addEventListener('close', () => {
    const n = nameInput.value.trim().slice(0, 14);
    if (n) S.name = n;
    const first = !S.named;
    S.named = true;
    save();
    render();
    if (first) { say(`Hi! I'm ${S.name}!`); flash('is-happy', 1300); hearts(3); }
  });
  $('name').addEventListener('click', askName);

  /* ---------- install / offline ---------- */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('installHint').hidden = false;
  });
  $('btnInstall').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('installHint').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('installHint').hidden = true; });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  /* ---------- lifecycle ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { advance(); save(); }
    else tick();
  });
  window.addEventListener('pagehide', () => { advance(); save(); });

  /* ---------- boot ---------- */
  paintIcons();
  const awayMin = (Date.now() - S.last) / 60000;
  const bootEvents = advance();
  render();
  save();
  if (!S.named) askName();
  else if (S.asleep) { /* let them sleep */ }
  else if (bootEvents.has('sick')) say("I got sick while you were away...", 3500);
  else if (awayMin > 60) say(needLine() || `You're back! I missed you!`, 3200);
  else say(pick(['Meow!', 'Hi again!', 'Nya~']));
  setInterval(tick, 1000);
})();
