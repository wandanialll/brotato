// The passage of time: needs drop, messes happen, gifts appear.
import { S, SPEED, clamp, pick, chance, trait, log, lonelyAfter } from './state.js';

const MAX_AWAY_MIN = 72 * 60; // simulate at most 3 days away

// Change per sim hour.
const RATES = {
  awake: { hunger: -9, fun: -11, energy: -7, clean: -4 },
  asleep: { hunger: -4, fun: -2, energy: 25, clean: -1 },
};

const GIFTS = ['mouse', 'sock', 'leaf'];
const GIFT_NAMES = { mouse: 'a toy mouse', sock: 'one of your socks', leaf: 'a crunchy leaf' };
const MESSES = ['cup', 'plant', 'scratch'];
const MESS_LOG = {
  cup: 'Knocked a mug off the table.',
  plant: 'Knocked over the plant.',
  scratch: 'Scratched up the wallpaper.',
};

export { GIFT_NAMES };

// Advance the world by `m` simulated minutes, collecting events.
function step(m, ev) {
  const h = m / 60;
  const r = S.asleep ? RATES.asleep : RATES.awake;
  const sickMul = S.sick ? 1.5 : 1;
  const heavy = S.weight > 5.2 ? 1.2 : 1;

  S.t += m;

  const hungerRate = r.hunger * (1 + 0.3 * trait('greedy'));
  const funRate = (S.asleep ? r.fun : r.fun * (1 + 0.35 * trait('playful')))
    - S.poops * 2 * (1 + 0.5 * trait('neat'))
    - (S.mess ? 1 + trait('neat') : 0);
  const energyRate = S.asleep
    ? r.energy * (S.sick ? 0.5 : 1)
    : r.energy * (1 - 0.25 * trait('playful')) * heavy * sickMul;
  const cleanRate = r.clean * (1 - 0.3 * trait('neat')) - S.poops * 6;

  S.hunger = clamp(S.hunger + hungerRate * h * sickMul);
  S.fun = clamp(S.fun + funRate * h * sickMul);
  S.energy = clamp(S.energy + energyRate * h);
  S.clean = clamp(S.clean + cleanRate * h);

  // weight slowly trims down, faster when starving
  S.weight = clamp(S.weight - (0.012 + (S.hunger < 15 ? 0.03 : 0)) * h, 2.5, 7.5);

  // neglect wears down the bond; loneliness too
  const neglected = S.hunger < 15 || S.fun < 15 || S.clean < 15;
  if (neglected) S.bond = clamp(S.bond - 0.6 * h);
  if (!S.asleep && S.t - S.lastCare > lonelyAfter()) S.bond = clamp(S.bond - 0.25 * (1 + trait('cuddly')) * h);
  S.discipline = clamp(S.discipline - 0.15 * h);

  // digestion
  if (S.poopIn != null) {
    S.poopIn -= m;
    if (S.poopIn <= 0) {
      S.poopIn = null;
      if (S.poops < 4) { S.poops++; ev.add('poop'); }
    }
  }

  // illness
  if (!S.sick) {
    let risk = 0;
    if (S.poops >= 2) risk += 0.0015 * S.poops;
    if (S.hunger < 10) risk += 0.002;
    if (S.clean < 10) risk += 0.002;
    if (S.fun < 5) risk += 0.001;
    if (S.weight > 6.2) risk += 0.0006;
    if (risk && chance(risk * m)) {
      S.sick = true;
      ev.add('sick');
      log('Came down with a cold.');
    }
  }

  if (!S.asleep) {
    // mischief: bored cats with little discipline knock things over
    if (!S.mess && S.fun < 60) {
      const p = 0.004 * (1 - S.discipline / 100) * (1 + 0.5 * trait('playful'));
      if (chance(p * m)) {
        const kind = pick(MESSES);
        S.mess = { kind, at: S.t, scolded: false };
        S.stats.messes++;
        ev.add('mess');
        log(MESS_LOG[kind]);
      }
    }
    // gifts: cats who love you bring you things
    if (!S.gift && S.bond > 45) {
      const p = 0.0012 * (S.bond / 100) * (1 + 0.4 * trait('brave'));
      if (chance(p * m)) {
        const kind = pick(GIFTS);
        S.gift = { kind, at: S.t };
        ev.add('gift');
        log(`Brought you ${GIFT_NAMES[kind]}.`);
      }
    }
  }

  // an ignored gift is a small heartbreak
  if (S.gift && S.t - S.gift.at > 90) {
    S.gift = null;
    S.fun = clamp(S.fun - 6);
    ev.add('giftIgnored');
    log('Put their gift away. Nobody noticed it.');
  }

  if (S.asleep && S.energy >= 100) { S.asleep = false; ev.add('woke'); }
  if (!S.asleep && S.energy <= 0) { S.asleep = true; ev.add('passout'); log('Fell asleep from exhaustion.'); }
}

// Catch the simulation up to `now`. Returns the set of events that happened.
export function advance(now = Date.now()) {
  let mins = Math.min(((now - S.last) / 60000) * SPEED, MAX_AWAY_MIN);
  S.last = now;
  const ev = new Set();
  while (mins > 0) {
    const m = Math.min(1, mins);
    step(m, ev);
    mins -= m;
  }
  return ev;
}

