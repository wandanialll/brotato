import { icon, paintIcons } from './icons.js';
import {
  S, SPEED, NEEDS, TRAITS, FOODS, clamp, rand, pick, chance, save, log, trait,
  traitLabel, weightLabel, cared,
} from './state.js';
import { advance, GIFT_NAMES } from './sim.js';
import { MOODS, moodId, setTemp, clearTemp, tempMood } from './mood.js';

/* =========================================================
 * DOM
 * ========================================================= */
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const pet = $('pet');
const speechEl = $('speech');
const fx = $('fx');
const menu = $('menu');
const contextEl = $('context');
const btn = { feed: $('btnFeed'), play: $('btnPlay'), care: $('btnCare'), sleep: $('btnSleep') };

let busy = false; // an animation or mini game is running
const isNight = () => { const h = new Date().getHours(); return h >= 20 || h < 7; };

// stat bars
const bars = {};
document.querySelectorAll('.stat').forEach((el) => {
  const bar = el.querySelector('.bar');
  bar.innerHTML = '<b></b>'.repeat(10);
  bars[el.dataset.stat] = { el, cells: [...bar.children] };
});

/* =========================================================
 * Speech & effects
 * ========================================================= */
let speechTimer = 0;
let lastSpoke = 0;
function say(text, ms = 2600) {
  speechEl.textContent = text;
  speechEl.classList.add('show');
  lastSpoke = Date.now();
  clearTimeout(speechTimer);
  speechTimer = setTimeout(() => speechEl.classList.remove('show'), ms);
  if (!S.asleep && !text.startsWith('*')) {
    pet.classList.add('talking');
    setTimeout(() => pet.classList.remove('talking'), 380);
  }
}
const sayMood = (id = moodId()) => { const l = MOODS[id].lines; if (l.length) say(pick(l)); };

function stageRect() { return stage.getBoundingClientRect(); }
function petPoint(fx_ = 0.5, fy = 0.3) {
  const r = pet.getBoundingClientRect();
  const s = stageRect();
  return [r.left - s.left + r.width * fx_, r.top - s.top + r.height * fy];
}
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
function burst(name, n = 3) {
  for (let i = 0; i < n; i++) {
    setTimeout(() => { const [x, y] = petPoint(rand(0.3, 0.7), 0.3); particle(name, x, y); }, i * 140);
  }
}
function bubbles(n = 18) {
  const s = stageRect();
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const b = document.createElement('span');
      b.className = 'bubble';
      b.style.left = `${rand(0.1, 0.85) * s.width}px`;
      b.style.top = `${rand(0.45, 0.9) * s.height}px`;
      fx.appendChild(b);
      setTimeout(() => b.remove(), 1500);
    }, i * 60);
  }
}
function tool(name, kind, ms) {
  const el = document.createElement('span');
  el.className = `tool ${kind}`;
  el.innerHTML = icon(name);
  const [x, y] = petPoint(0.45, kind === 'wave' ? 0.05 : 0.55);
  el.style.left = `${x - 25}px`;
  el.style.top = `${y - 25}px`;
  fx.appendChild(el);
  setTimeout(() => el.remove(), ms);
  return el;
}
function flash(cls, ms) {
  pet.classList.add(cls);
  setTimeout(() => pet.classList.remove(cls), ms);
}
function stageFlash(cls, ms) {
  stage.classList.remove(cls);
  void stage.offsetWidth; // restart animation
  stage.classList.add(cls);
  setTimeout(() => stage.classList.remove(cls), ms);
}

/* ---------- blinking ---------- */
(function blinkLoop() {
  setTimeout(() => {
    if (!S.asleep && ['normal', 'wide', 'sparkle', 'half', 'sly'].includes(MOODS[moodId()].eyes)) {
      pet.classList.add('blink');
      setTimeout(() => pet.classList.remove('blink'), 140);
    }
    blinkLoop();
  }, rand(2200, 5200));
})();

/* ---------- wandering ---------- */
let walkTimer = 0;
function walkTo(x, fast = false) {
  const cur = Number(pet.style.getPropertyValue('--x')) || 50;
  if (Math.abs(x - cur) < 3) return;
  pet.classList.toggle('face-left', x < cur);
  pet.classList.toggle('fast', fast);
  pet.classList.add('walking');
  pet.style.setProperty('--x', x.toFixed(1));
  clearTimeout(walkTimer);
  walkTimer = setTimeout(() => pet.classList.remove('walking', 'fast'), fast ? 500 : 1600);
}
function zoomies(times = 6) {
  for (let i = 0; i < times; i++) setTimeout(() => walkTo(i % 2 ? 36 : 64, true), i * 520);
  setTimeout(() => walkTo(50), times * 520 + 100);
}

/* =========================================================
 * Rendering
 * ========================================================= */
const POOP_SPOTS = [12, 74, 4, 84];
let lastPoops = -1;
function renderPoops() {
  if (lastPoops === S.poops) return;
  lastPoops = S.poops;
  const el = $('poops');
  el.classList.remove('cleaning');
  el.innerHTML = '';
  for (let i = 0; i < S.poops; i++) {
    const p = document.createElement('span');
    p.className = 'poop';
    p.style.left = `${POOP_SPOTS[i]}%`;
    p.innerHTML = icon('poop');
    el.appendChild(p);
  }
}

function setOnce(el, key, html) {
  if (el.dataset.k === key) return;
  el.dataset.k = key;
  el.innerHTML = html;
}

const EYE_CLASSES = ['normal', 'closed', 'half', 'happy', 'angry', 'sad', 'wide', 'sparkle', 'sly'].map((e) => `eyes-${e}`);
const ANIM_CLASSES = ['idle', 'bounce', 'shiver', 'stomp', 'tilt', 'still', 'breathe'].map((a) => `anim-${a}`);
let lastMood = '';

function renderPet(id) {
  const m = MOODS[id];
  if (id !== lastMood) {
    pet.classList.remove(...EYE_CLASSES, ...ANIM_CLASSES);
    pet.classList.add(`eyes-${m.eyes}`, `anim-${m.anim}`);
    pet.classList.toggle('has-blush', !!m.blush);
    pet.classList.toggle('has-tears', !!m.tears);
    pet.classList.toggle('tint', !!m.tint);
    pet.classList.toggle('sulky', id === 'sulking');
    if (m.turn) pet.classList.add('face-left');
    lastMood = id;
  }
  pet.classList.toggle('in-box', id === 'cozy');
  setOnce($('emote'), m.emote || '', m.emote ? icon(m.emote) : '');
  setOnce($('moodIcon'), m.emote || 'note', icon(m.emote || 'note'));
  $('moodLabel').textContent = m.label;
  $('moodDesc').textContent = m.desc;
  pet.setAttribute('aria-label', `Pet ${S.name} (feeling ${m.label.toLowerCase()})`);
}

function renderBond() {
  const full = Math.round(S.bond / 20);
  const el = $('bond');
  setOnce(el, String(full), Array.from({ length: 5 }, (_, i) => icon(i < full ? 'heart' : 'heartEmpty')).join(''));
  el.setAttribute('aria-label', `Bond: ${full} of 5 hearts`);
}

function renderRoom() {
  renderPoops();
  const messEl = $('mess');
  const hasFloorMess = S.mess && S.mess.kind !== 'scratch';
  messEl.hidden = !hasFloorMess;
  if (hasFloorMess) setOnce(messEl, S.mess.kind, icon(S.mess.kind));
  $('scratch').hidden = !(S.mess && S.mess.kind === 'scratch');
  const giftEl = $('gift');
  giftEl.hidden = !S.gift;
  if (S.gift) setOnce(giftEl, S.gift.kind, icon(S.gift.kind));
  stage.classList.toggle('lights-off', S.asleep);
  stage.classList.toggle('night', isNight());
}

const canScold = () => S.mess && !S.mess.scolded && S.t - S.mess.at <= 30;
function renderContext() {
  const items = [];
  if (S.sick) items.push(['meds', 'pill', 'Give medicine', 'urgent']);
  if (S.gift) items.push(['praise', 'hand', `Praise the ${S.gift.kind}`, 'good']);
  if (canScold()) items.push(['scold', 'no', 'Scold', 'urgent']);
  const key = items.map((i) => i[0]).join() + busy;
  if (contextEl.dataset.k === key) return;
  contextEl.dataset.k = key;
  contextEl.innerHTML = items
    .map(([id, ic, label, cls]) => `<button type="button" class="${cls}" data-ctx="${id}" ${busy ? 'disabled' : ''}>${icon(ic)}<span>${label}</span></button>`)
    .join('');
  contextEl.querySelectorAll('svg').forEach((svg) => {
    const i = document.createElement('i');
    svg.replaceWith(i);
    i.appendChild(svg);
  });
}

function render() {
  for (const k of NEEDS) {
    const v = S[k];
    const on = Math.ceil(v / 10);
    const { el, cells } = bars[k];
    cells.forEach((c, i) => c.classList.toggle('off', i >= on));
    el.classList.toggle('low', v < 25);
    el.classList.toggle('mid', v >= 25 && v < 50);
    el.setAttribute('aria-label', `${el.querySelector('.label').textContent} ${Math.round(v)}%`);
  }

  renderPet(moodId());
  renderBond();
  renderRoom();
  renderContext();

  // the cat gets visibly rounder as weight goes up
  const wide = 1 + clamp((S.weight - 4.3) * 0.045, -0.05, 0.12);
  pet.querySelector('.sprite').style.scale = `${wide.toFixed(3)} 1`;

  btn.sleep.querySelector('span').textContent = S.asleep ? 'Wake' : 'Sleep';
  const si = btn.sleep.querySelector('i');
  const sleepIcon = S.asleep ? 'sun' : 'moon';
  if (si.dataset.icon !== sleepIcon) { si.dataset.icon = sleepIcon; si.innerHTML = icon(sleepIcon); }
  btn.feed.disabled = btn.play.disabled = btn.care.disabled = S.asleep || busy;
  btn.sleep.disabled = busy;

  $('age').textContent = `Day ${Math.floor(S.t / 1440) + 1}`;
  $('name').textContent = S.name;
  $('clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* =========================================================
 * Menus
 * ========================================================= */
let menuFor = null;
function openMenu(id, title, items) {
  if (menuFor === id) return closeMenu();
  menuFor = id;
  menu.innerHTML = `<h4>${title}</h4>` + items.map((it) => `
    <button type="button" data-item="${it.id}" ${it.disabled ? 'disabled' : ''}>
      <i>${icon(it.icon)}</i>
      <span class="txt">${it.label}${it.note ? `<small>${it.note}</small>` : ''}</span>
      ${it.tag ? `<span class="tag ${it.tagClass || ''}">${it.tag}</span>` : ''}
    </button>`).join('') + '<button type="button" data-item="cancel" class="ghost">Never mind</button>';
  menu.hidden = false;
  menu._handlers = Object.fromEntries(items.map((it) => [it.id, it.run]));
}
function closeMenu() { menu.hidden = true; menuFor = null; }
menu.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-item]');
  if (!b) return;
  const run = menu._handlers[b.dataset.item];
  closeMenu();
  if (run) { run(); render(); save(); }
});

/* =========================================================
 * Actions
 * ========================================================= */
function guardAwake() {
  if (!S.asleep) return true;
  say(pick(['Zzz...', '*snore*', '...mrrp (still sleeping)']));
  return false;
}
function happyBump(n = 2) { flash('is-happy', 1300); burst('heart', n); }
function addBond(n) { S.bond = clamp(S.bond + n); }

// ---------- feeding ----------
function feedMenu() {
  if (!guardAwake()) return;
  const hourAgo = S.t - 60;
  S.snacks = S.snacks.filter((t) => t > hourAgo);
  openMenu('feed', 'Feed', Object.entries(FOODS).map(([id, f]) => ({
    id,
    icon: f.icon,
    label: f.label,
    note: f.treat ? `${3 - S.snacks.length} left this hour` : f.tummy ? 'Light. Can upset tummies' : '',
    tag: id === S.likes ? 'Favourite' : id === S.dislikes ? 'Dislikes' : '',
    tagClass: id === S.dislikes ? 'bad' : '',
    disabled: f.treat && S.snacks.length >= 3,
    run: () => eat(id),
  })));
}

function eat(id) {
  const f = FOODS[id];
  const sulking = tempMood() === 'sulking';
  if (sulking && !f.treat) return say('Hmph. Not hungry.');
  if (f.meal && S.hunger > 90) return say("I'm stuffed!");
  if (id === S.dislikes && trait('greedy') < 0 && chance(0.25 - trait('greedy') * 0.6)) {
    S.fun = clamp(S.fun - 3);
    log(`Refused the ${f.label.toLowerCase()}.`);
    setTemp('annoyed', 6);
    return say(`Ew, ${f.label.toLowerCase()}? No thanks.`);
  }

  busy = true;
  cared();
  const plate = document.createElement('span');
  plate.className = 'food';
  plate.innerHTML = icon(f.icon);
  stage.appendChild(plate);
  pet.classList.add('is-eating');
  const favourite = id === S.likes;
  say(favourite ? 'My favourite!! Nom nom!' : id === S.dislikes ? '*eats reluctantly*' : f.treat ? 'A treat!? Yay!' : 'Nom nom nom!', 1800);

  setTimeout(() => {
    plate.remove();
    pet.classList.remove('is-eating');
    advance();
    S.hunger = clamp(S.hunger + f.hunger);
    S.fun = clamp(S.fun + f.fun + (favourite ? 10 : 0) - (id === S.dislikes ? 5 : 0));
    S.weight = clamp(S.weight + f.weight * (1 + 0.3 * trait('greedy')), 2.5, 7.5);
    if (f.meal) {
      S.clean = clamp(S.clean - 3);
      S.stats.meals++;
      if (S.poopIn == null) S.poopIn = rand(45, 120);
      if (f.tummy && chance(0.35)) S.poopIn = Math.min(S.poopIn, rand(10, 30));
    } else {
      S.snacks.push(S.t);
    }
    if (favourite) { addBond(1.5); setTemp('loving', 12); }
    if (sulking && f.treat) { clearTemp(); addBond(1); log('Forgave you, for a treat.'); say('...Fine. You are forgiven.'); }
    if (S.weight > 6) setTimeout(() => say('*waddles*'), 1500);
    busy = false;
    happyBump(favourite ? 3 : 2);
    render();
    save();
  }, 1800);
}

// ---------- playing ----------
function playMenu() {
  if (!guardAwake()) return;
  const nipReady = S.t - S.catnipAt > 360;
  openMenu('play', 'Play', [
    { id: 'yarn', icon: 'yarn', label: 'Chase the yarn', note: 'Mini game · tiring', run: startGame },
    { id: 'feather', icon: 'feather', label: 'Feather wand', note: 'Quick play · tiring', run: playFeather },
    { id: 'box', icon: 'box', label: 'Cardboard box', note: 'Cozy · no energy needed', run: playBox },
    { id: 'catnip', icon: 'catnip', label: 'Catnip', note: nipReady ? 'Wild for a bit, then tired' : 'Not again so soon', disabled: !nipReady, run: playCatnip },
  ]);
}

function canPlay() {
  if (S.sick) { say('Too sick to play...'); return false; }
  if (tempMood() === 'sulking') { say("Hmph. I don't want to play with you."); return false; }
  if (S.energy < 15) { say('Too tired... maybe later.'); return false; }
  if (trait('playful') < -0.4 && S.energy < 40 && chance(0.5)) { say('Meh. Too much effort.'); return false; }
  return true;
}

function playFeather() {
  if (!canPlay()) return;
  busy = true;
  cared();
  tool('feather', 'wave', 2200);
  pet.classList.add('anim-bounce');
  say(pick(['*pounce!*', 'Gotcha!', 'Mrrrp!']), 2000);
  setTimeout(() => {
    pet.classList.remove('anim-bounce');
    lastMood = '';
    advance();
    S.fun = clamp(S.fun + 15 * (1 + 0.3 * trait('playful')));
    S.energy = clamp(S.energy - 8);
    S.hunger = clamp(S.hunger - 2);
    S.weight = clamp(S.weight - 0.03, 2.5, 7.5);
    addBond(1);
    busy = false;
    happyBump();
    render();
    save();
  }, 2200);
}

function playBox() {
  if (tempMood() === 'cozy') return say('Already in my box!');
  if (S.sick) return say('Too sick to play...');
  cared();
  S.fun = clamp(S.fun + 12);
  addBond(0.5);
  setTemp('cozy', 90);
  walkTo(50);
  say(pick(MOODS.cozy.lines));
  log('Spent some time sitting in a box.');
}

function playCatnip() {
  if (S.sick) return say('Too sick to play...');
  cared();
  S.catnipAt = S.t;
  S.fun = clamp(S.fun + 25);
  S.energy = clamp(S.energy - 15);
  setTemp('excited', 30);
  say('Ooooh... WHEEEE!');
  zoomies(8);
  log('Went wild on catnip.');
}

// the yarn mini game
const yarn = $('yarn');
const hud = $('gameHud');
let game = null;

function startGame() {
  if (!canPlay()) return;
  busy = true;
  cared();
  game = { score: 0, time: 12 };
  $('gameScore').textContent = '0';
  $('gameTime').textContent = String(game.time);
  yarn.innerHTML = icon('yarn');
  hud.hidden = false;
  yarn.hidden = false;
  stage.classList.add('playing');
  moveYarn();
  game.mover = setInterval(moveYarn, 950);
  game.timer = setInterval(() => {
    game.time--;
    $('gameTime').textContent = String(game.time);
    if (game.time <= 0) endGame();
  }, 1000);
  say('Catch it! Catch it!', 1500);
  render();
}
function moveYarn() {
  const s = stageRect();
  const x = rand(0.04, 0.82);
  yarn.style.left = `${x * s.width}px`;
  yarn.style.top = `${rand(0.2, 0.7) * s.height}px`;
  walkTo(clamp(x * 100 + 6, 36, 64));
}
yarn.addEventListener('pointerdown', (e) => {
  if (!game) return;
  e.preventDefault();
  game.score++;
  $('gameScore').textContent = String(game.score);
  S.fun = clamp(S.fun + 4 * (1 + 0.3 * trait('playful')));
  S.energy = clamp(S.energy - 1.5);
  S.hunger = clamp(S.hunger - 1);
  S.weight = clamp(S.weight - 0.01, 2.5, 7.5);
  const s = stageRect();
  const r = yarn.getBoundingClientRect();
  particle('heart', r.left - s.left + r.width / 2, r.top - s.top);
  moveYarn();
  render();
});
function endGame() {
  clearInterval(game.mover);
  clearInterval(game.timer);
  const { score } = game;
  game = null;
  yarn.hidden = true;
  hud.hidden = true;
  stage.classList.remove('playing');
  busy = false;
  S.stats.games++;
  addBond(score > 0 ? 2 : 0.5);
  const record = score > S.stats.best;
  if (record) S.stats.best = score;
  if (score >= 8) {
    setTemp('proud', 20);
    say(record ? `${score} catches! A new record!` : `${score} catches! I'm the best!`);
    burst('star', 4);
    log(`Caught the yarn ${score} times${record ? ' (new record!)' : ''}.`);
  } else if (score > 0) {
    say(`Caught ${score}! Fun!`);
    flash('is-happy', 1300);
  } else {
    say('Aww, it got away...');
  }
  walkTo(50);
  render();
  save();
}

// ---------- care ----------
function careMenu() {
  if (!guardAwake()) return;
  const dirty = S.poops > 0 || (S.mess && true);
  openMenu('care', 'Care', [
    { id: 'brush', icon: 'brush', label: 'Brush fur', note: 'Gentle clean · builds bond', run: doBrush },
    { id: 'bath', icon: 'bath', label: 'Bath', note: 'Squeaky clean · most cats hate it', run: doBath },
    { id: 'tidy', icon: 'scoop', label: 'Tidy up', note: dirty ? 'Clear the mess' : 'Nothing to tidy', disabled: !dirty, run: doTidy },
  ]);
}

function doBrush() {
  if (tempMood() === 'annoyed') return say('Hssss! Not now!');
  busy = true;
  cared();
  tool('brush', 'sweep', 1800);
  const fussy = trait('cuddly') < -0.3 && chance(0.4);
  say(fussy ? 'Hmm... okay, but quickly.' : 'Purrrr...', 1800);
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const [x, y] = petPoint(rand(0.3, 0.7), rand(0.4, 0.7));
      const f = document.createElement('span');
      f.className = 'fur';
      f.style.left = `${x}px`;
      f.style.top = `${y}px`;
      fx.appendChild(f);
      setTimeout(() => f.remove(), 1000);
    }, i * 300);
  }
  setTimeout(() => {
    advance();
    S.clean = clamp(S.clean + 15);
    if (fussy) { setTemp('annoyed', 12); S.fun = clamp(S.fun - 3); say('Enough brushing!'); }
    else { addBond(1.5 * (1 + 0.5 * trait('cuddly'))); S.fun = clamp(S.fun + 4); happyBump(); }
    busy = false;
    render();
    save();
  }, 1800);
}

function doBath() {
  if (S.clean > 90 && S.poops === 0) return say('Already squeaky clean!');
  busy = true;
  cared();
  bubbles();
  say(pick(['NOOO not the water!', 'Mrrraow?!', '*wet cat noises*']), 1600);
  setTimeout(() => {
    advance();
    S.clean = 100;
    S.stats.baths++;
    const neat = trait('neat');
    const brave = trait('brave');
    S.fun = clamp(S.fun - 12 * (1 - 0.5 * neat));
    if (neat > 0.5) { say('Ahh, fresh and fluffy.'); flash('is-happy', 1300); }
    else if (brave < -0.4) { setTemp('scared', 15); say('Th-that was terrifying...'); log('Was terrified by a bath.'); }
    else { setTemp('sulking', 45); say('Hmph! I am WET.'); log('Sulked after a bath.'); }
    busy = false;
    render();
    save();
  }, 1200);
}

function doTidy() {
  cared();
  $('poops').classList.add('cleaning');
  bubbles(8);
  const neat = trait('neat');
  setTimeout(() => {
    S.poops = 0;
    S.mess = null;
    S.clean = clamp(S.clean + 10);
    S.fun = clamp(S.fun + 3 + 4 * Math.max(0, neat));
    say(neat > 0.3 ? 'Much better. I like it tidy.' : 'Thanks!');
    render();
    save();
  }, 800);
}

// ---------- sleep ----------
function toggleSleep() {
  closeMenu();
  cared();
  if (S.asleep) {
    S.asleep = false;
    if (S.energy < 50) {
      S.fun = clamp(S.fun - 10);
      setTemp('annoyed', 20);
      say('Grrr... too early!');
      log('Got woken up too early. Grumpy.');
    } else say('*stretch* Morning!');
    return;
  }
  const limit = 85 + 8 * trait('playful');
  if (S.energy > limit) return say(trait('playful') < -0.3 ? 'Hmm... maybe a short nap.' : 'Not sleepy!');
  S.asleep = true;
  clearTemp();
  walkTo(50);
  say('Goodnight...', 1800);
}

// ---------- contextual ----------
function giveMeds() {
  if (!S.sick) return;
  cared();
  S.sick = false;
  S.fun = clamp(S.fun - 5);
  setTemp('annoyed', 8);
  say('Bleh! ...but I feel better.');
  log('Took medicine and got better.');
}
function praiseGift() {
  if (!S.gift) return;
  cared();
  const name = GIFT_NAMES[S.gift.kind];
  S.gift = null;
  S.stats.gifts++;
  addBond(4);
  S.fun = clamp(S.fun + 8);
  setTemp('proud', 20);
  say(pick(['You like it?!', 'I caught it myself!', 'For you!']));
  burst('star', 3);
  log(`You loved the gift (${name}).`);
}
function scold() {
  if (!canScold()) return;
  cared();
  S.mess.scolded = true;
  S.discipline = clamp(S.discipline + 15);
  addBond(-1);
  if (trait('brave') < -0.3) { setTemp('sulking', 60); say('*hides* ...sorry.'); }
  else { setTemp('guilty', 25); say(pick(MOODS.guilty.lines)); }
  log('Got told off for making a mess.');
}
contextEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-ctx]');
  if (!b || busy) return;
  ({ meds: giveMeds, praise: praiseGift, scold })[b.dataset.ctx]();
  render();
  save();
});

// ---------- petting ----------
let petTimes = [];
let lastBondPet = 0;
function petCat() {
  if (game) return;
  closeMenu();
  if (S.asleep) {
    if (trait('cuddly') > 0.3) { say('*purrs in sleep*'); burst('heart', 1); }
    else say(pick(['Zzz...', '*snore*']));
    return;
  }
  const id = moodId();
  cared();
  if (id === 'sulking') {
    if (S.bond > 55 && chance(0.35)) { clearTemp(); say('...Okay. Fine.'); burst('heart', 1); }
    else { say(pick(['Hmph.', '*turns away*', '...'])); pet.classList.add('face-left'); }
    return;
  }
  if (id === 'annoyed') {
    setTemp('annoyed', 10);
    S.fun = clamp(S.fun - 2);
    return say(pick(['*swat!*', 'Hssss!']));
  }
  if (id === 'scared') {
    clearTemp();
    setTemp('loving', 20);
    addBond(3);
    say("I'm okay now... thank you.");
    burst('heart', 4);
    log('You comforted them when they were scared.');
    return;
  }

  // too much petting annoys independent cats
  const now = Date.now();
  petTimes = petTimes.filter((t) => now - t < 8000);
  petTimes.push(now);
  const limit = 5 + Math.round(4 * trait('cuddly')) + Math.floor(S.bond / 25);
  if (petTimes.length > limit) {
    petTimes = [];
    setTemp('annoyed', 20);
    addBond(-0.5);
    return say(pick(['Enough!', 'Too much petting!', '*swat!*']));
  }

  burst('heart', S.sick ? 1 : 3);
  S.stats.pets++;
  if (now - lastBondPet > 1200) {
    S.fun = clamp(S.fun + 3 + 2 * trait('cuddly'));
    addBond(0.4);
    lastBondPet = now;
  }
  if (S.sick) return say('Purr... (weakly)', 1500);
  if (S.bond > 60 && chance(0.25)) setTemp('loving', 10);
  say(pick(['Purrrr~', 'Mrrp!', '*headbutt*', 'More pets!', '*slow blink*']), 1500);
  if (chance(0.35)) flash('is-happy', 1300);
}

btn.feed.addEventListener('click', () => { feedMenu(); render(); });
btn.play.addEventListener('click', () => { playMenu(); render(); });
btn.care.addEventListener('click', () => { careMenu(); render(); });
btn.sleep.addEventListener('click', () => { toggleSleep(); render(); save(); });
pet.addEventListener('click', () => { petCat(); render(); save(); });
stage.addEventListener('click', (e) => {
  if (!menu.hidden && !e.target.closest('#menu')) closeMenu();
});
$('gift').addEventListener('click', () => { if (!busy) { praiseGift(); render(); save(); } });

/* =========================================================
 * Live events while the app is open
 * ========================================================= */
let stormUntil = 0;
function liveEvents() {
  if (busy || S.asleep || game) return;
  const id = moodId();
  const calm = !['sulking', 'scared', 'annoyed', 'sick', 'cozy'].includes(id);

  // wandering about
  if (calm && id !== 'sleepy' && chance(1 / 9)) walkTo(rand(36, 64));

  // thunderstorm at night
  if (isNight() && Date.now() > stormUntil && chance(1 / 1500)) {
    stormUntil = Date.now() + 45000;
    stage.classList.add('storm');
    setTimeout(() => stage.classList.remove('storm'), 45000);
    stageFlash('flashing', 800);
    if (trait('brave') > 0.5) { say('Pfft. Just thunder.'); }
    else {
      setTemp('scared', 25 * (1 - 0.5 * trait('brave')));
      say(pick(MOODS.scared.lines));
      log('Was scared by a thunderstorm.');
    }
    return;
  }
  // butterfly at the window
  if (!isNight() && calm && chance(1 / 900)) {
    stage.classList.add('butterflying');
    setTimeout(() => stage.classList.remove('butterflying'), 9000);
    setTemp('curious', 9);
    walkTo(38);
    say('Ooh! A butterfly!');
    S.fun = clamp(S.fun + 3);
    return;
  }
  // zoomies
  if (calm && S.energy > 70 && trait('playful') > 0 && chance(1 / 1200)) {
    setTemp('excited', 5);
    say('*ZOOMIES*');
    zoomies(6);
    S.energy = clamp(S.energy - 4);
    return;
  }
  // hairball
  if (S.clean < 40 && chance(1 / 1500)) {
    flash('coughing', 1500);
    say('*hack* *hack* ...hairball.');
    S.clean = clamp(S.clean - 5);
    log('Coughed up a hairball. Brushing helps!');
  }
}

function handleEvents(ev) {
  if (ev.has('sick')) say("I don't feel so good...", 3500);
  else if (ev.has('passout')) say('*flops over* ...zzz', 3000);
  else if (ev.has('woke')) { say('*stretch* Good morning!'); flash('is-happy', 1300); }
  else if (ev.has('gift')) { setTemp('excited', 10); say('I brought you something!', 3000); }
  else if (ev.has('mess')) {
    const sorry = S.discipline > 55;
    setTemp(sorry ? 'guilty' : 'mischief', 30);
    say(pick(MOODS[sorry ? 'guilty' : 'mischief'].lines));
  } else if (ev.has('poop')) say(pick(['Oops...', 'Uh oh.', "Wasn't me!"]));
  else if (ev.has('giftIgnored')) say('*puts the gift away sadly*');
}

/* =========================================================
 * Loop
 * ========================================================= */
let lastSave = 0;
function tick() {
  handleEvents(advance());
  liveEvents();
  render();
  if (Date.now() - lastSave > 5000) { save(); lastSave = Date.now(); }
  if (!busy && !S.asleep && !game && Date.now() - lastSpoke > rand(14000, 26000)) sayMood();
}

// Greet the player after time away, depending on how they were treated.
function greet(awayMin, bondBefore) {
  if (S.asleep || awayMin < 60) return false;
  const neglected = NEEDS.some((k) => S[k] < 15) || S.bond < bondBefore - 4;
  if (neglected) {
    setTemp('sulking', 240);
    say('Hmph. Where were you?', 3200);
    log('Sulked: felt neglected while you were away.');
  } else if (S.bond >= 50) {
    setTemp('excited', 10);
    say("You're back!! I missed you!", 3200);
    zoomies(2);
  } else {
    sayMood();
  }
  return true;
}

/* ---------- profile ---------- */
function fmtTime(ts) {
  const d = new Date(ts);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function openProfile() {
  closeMenu();
  advance();
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  $('pName').textContent = S.name;
  $('pAge').textContent = `Day ${Math.floor(S.t / 1440) + 1} · feeling ${MOODS[moodId()].label.toLowerCase()}`;
  const hearts = Array.from({ length: 5 }, (_, i) => `<i>${icon(i < Math.round(S.bond / 20) ? 'heart' : 'heartEmpty')}</i>`).join('');
  $('pFacts').innerHTML = `
    <dt>Bond</dt><dd>${hearts}</dd>
    <dt>Discipline</dt><dd><span class="mini-bar"><b style="width:${Math.round(S.discipline)}%"></b></span></dd>
    <dt>Weight</dt><dd>${S.weight.toFixed(1)} kg · ${weightLabel()}</dd>
    <dt>Favourite</dt><dd><i>${icon(FOODS[S.likes].icon)}</i>${FOODS[S.likes].label}</dd>
    <dt>Dislikes</dt><dd><i>${icon(FOODS[S.dislikes].icon)}</i>${FOODS[S.dislikes].label}</dd>
    <dt>Best catch</dt><dd>${S.stats.best} yarn${S.stats.best === 1 ? '' : 's'}</dd>
    <dt>Gifts</dt><dd>${S.stats.gifts} received</dd>`;
  $('pTraits').innerHTML = TRAITS.map((tr) => {
    const v = trait(tr.id);
    return `<li title="${esc(tr.hint)}">
      <span class="ends"><span>${tr.neg}</span><b>${traitLabel(tr)}</b><span>${tr.pos}</span></span>
      <span class="scale"><span style="left:${((v + 1) / 2) * 100}%"></span></span>
    </li>`;
  }).join('');
  $('pDiary').innerHTML = S.diary.length
    ? S.diary.map((d) => `<li><time>${fmtTime(d.at)}</time><span>${esc(d.text)}</span></li>`).join('')
    : '<li class="empty">Nothing yet. Life is just beginning!</li>';
  $('profileDialog').showModal();
}
$('btnProfile').addEventListener('click', openProfile);

/* ---------- naming ---------- */
const nameDialog = $('nameDialog');
const nameInput = $('nameInput');
function askName() {
  nameInput.value = S.name;
  if (typeof nameDialog.showModal === 'function') nameDialog.showModal();
}
nameDialog.addEventListener('close', () => {
  const n = nameInput.value.trim().slice(0, 14);
  if (n) S.name = n;
  const first = !S.named;
  S.named = true;
  if (first) {
    S.lastCare = S.t;
    log(`${S.name} came home!`);
    say(`Hi! I'm ${S.name}!`);
    happyBump(3);
  }
  save();
  render();
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
let hiddenAt = 0;
let bondAtHide = S.bond;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    advance();
    save();
    hiddenAt = Date.now();
    bondAtHide = S.bond;
  } else {
    const away = hiddenAt ? ((Date.now() - hiddenAt) / 60000) * SPEED : 0;
    handleEvents(advance());
    greet(away, bondAtHide);
    render();
  }
});
window.addEventListener('pagehide', () => { advance(); save(); });

/* ---------- boot ---------- */
paintIcons();
const awayMin = ((Date.now() - S.last) / 60000) * SPEED;
const bondBefore = S.bond;
const bootEvents = advance();
render();
save();
if (!S.named) askName();
else if (!greet(awayMin, bondBefore)) {
  if (bootEvents.has('sick')) say('I got sick while you were away...', 3500);
  else if (!S.asleep) say(pick(['Meow!', 'Hi again!', 'Nya~']));
}
render();
setInterval(tick, 1000);

// handy for debugging in the console
window.brotato = { S, MOODS, setTemp, render };
