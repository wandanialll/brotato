// Game state, persistence and shared helpers.
// Time inside the game is counted in simulated minutes (S.t) so that the
// ?speed= dev flag and offline catch-up behave the same everywhere.

export const SAVE_KEY = 'brotato.save.v1';
// Dev helper: add ?speed=60 to the URL to run time 60x faster.
export const SPEED = Math.max(1, Number(new URLSearchParams(location.search).get('speed')) || 1);

export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;

export const NEEDS = ['hunger', 'fun', 'energy', 'clean'];

// Personality: each trait runs from -1 (neg) to +1 (pos).
export const TRAITS = [
  { id: 'playful', pos: 'Playful', neg: 'Lazy', hint: 'How much they love to play, and how quickly they get bored.' },
  { id: 'cuddly', pos: 'Cuddly', neg: 'Independent', hint: 'How much attention they want, and how much petting they put up with.' },
  { id: 'greedy', pos: 'Foodie', neg: 'Picky', hint: 'How fast they get hungry, and whether they refuse food they dislike.' },
  { id: 'brave', pos: 'Brave', neg: 'Timid', hint: 'How they cope with thunder, baths and being told off.' },
  { id: 'neat', pos: 'Tidy', neg: 'Scruffy', hint: 'How fast they get dirty, and how much a mess bothers them.' },
];

export const FOODS = {
  fish: { label: 'Fish dinner', icon: 'fish', hunger: 32, fun: 0, weight: 0.05, meal: true },
  chicken: { label: 'Chicken', icon: 'chicken', hunger: 28, fun: 4, weight: 0.05, meal: true },
  milk: { label: 'Milk', icon: 'milk', hunger: 16, fun: 2, weight: 0.02, meal: true, tummy: true },
  treat: { label: 'Treat', icon: 'cookie', hunger: 8, fun: 12, weight: 0.04, treat: true },
};
const MAIN_FOODS = ['fish', 'chicken', 'milk'];

function rollTrait() {
  // spread out, but rarely all the way to the ends
  return Math.round((Math.random() * 2 - 1) * 0.9 * 100) / 100;
}

export function fresh() {
  const likes = pick(MAIN_FOODS);
  const dislikes = pick(MAIN_FOODS.filter((f) => f !== likes));
  return {
    v: 2,
    name: 'Brotato',
    named: false,
    born: Date.now(),
    last: Date.now(),
    t: 0, // simulated minutes since birth

    // needs
    hunger: 75,
    fun: 80,
    energy: 90,
    clean: 100,

    // long-term attributes
    bond: 25,
    discipline: 30,
    weight: 4.0,

    traits: Object.fromEntries(TRAITS.map((tr) => [tr.id, rollTrait()])),
    likes,
    dislikes,

    poops: 0,
    poopIn: null,
    sick: false,
    asleep: false,
    snacks: [],
    catnipAt: -9999,
    lastCare: 0,

    mess: null, // { kind, at, scolded }
    gift: null, // { kind, at }
    temp: null, // { id, until } short-lived emotion (real ms)

    diary: [],
    stats: { meals: 0, games: 0, best: 0, pets: 0, gifts: 0, messes: 0, baths: 0 },
  };
}

function migrate(saved) {
  const base = fresh();
  const s = Object.assign(base, saved);
  s.traits = Object.assign(base.traits, saved.traits || {});
  s.stats = Object.assign(fresh().stats, saved.stats || {});
  if (!saved.v || saved.v < 2) {
    s.t = Math.max(0, (Date.now() - (saved.born || Date.now())) / 60000);
    s.lastCare = s.t;
    s.snacks = [];
    s.v = 2;
  }
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (_) { /* storage blocked or corrupt: start fresh */ }
  return fresh();
}

export const S = load();

export function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (_) { /* ignore */ }
}

export function log(text) {
  const top = S.diary[0];
  if (top && top.base === text) { // collapse repeats: "Fell asleep (x3)"
    top.n = (top.n || 1) + 1;
    top.text = `${text} (x${top.n})`;
    top.at = Date.now();
    return;
  }
  S.diary.unshift({ at: Date.now(), text, base: text });
  if (S.diary.length > 40) S.diary.length = 40;
}

export const trait = (id) => S.traits[id] || 0;

export function traitLabel(tr) {
  const v = trait(tr.id);
  if (Math.abs(v) < 0.2) return 'Balanced';
  const word = v > 0 ? tr.pos : tr.neg;
  return Math.abs(v) > 0.6 ? `Very ${word.toLowerCase()}` : word;
}

export function weightLabel(w = S.weight) {
  if (w < 3.3) return 'Skinny';
  if (w <= 5) return 'Healthy';
  if (w <= 6) return 'Chubby';
  return 'Round';
}

// How long without attention before they feel lonely (sim minutes).
export const lonelyAfter = () => 240 - 120 * trait('cuddly');

// Mark that the player just interacted.
export function cared() { S.lastCare = S.t; }
