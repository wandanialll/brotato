// Emotions: worked out from needs, personality, bond and recent events.
import { S, NEEDS, trait, lonelyAfter } from './state.js';

// eyes:  normal | closed | half | happy | angry | sad | wide | sparkle | sly
// anim:  idle | bounce | shiver | stomp | tilt | still
export const MOODS = {
  sleeping: {
    label: 'Asleep', eyes: 'closed', anim: 'breathe', emote: null,
    desc: 'Sweet dreams. Let them rest.',
    lines: [],
  },
  sick: {
    label: 'Sick', eyes: 'half', anim: 'shiver', emote: 'thermo', tint: true,
    desc: 'Feeling poorly. Give them medicine.',
    lines: ["I don't feel so good...", '*cough cough*', 'Medicine... please?'],
  },
  scared: {
    label: 'Scared', eyes: 'wide', anim: 'shiver', emote: 'exclaim',
    desc: 'Frightened! Pet them to comfort them.',
    lines: ['Eek!!', "W-what was that?!", '*hides under hat*'],
  },
  sulking: {
    label: 'Sulking', eyes: 'angry', anim: 'still', emote: 'dots', turn: true,
    desc: 'Giving you the cold shoulder. Try a treat, or give them space.',
    lines: ['Hmph.', "I'm not talking to you.", '...'],
  },
  annoyed: {
    label: 'Annoyed', eyes: 'angry', anim: 'stomp', emote: 'vein',
    desc: 'Grumpy right now. Best leave them be for a moment.',
    lines: ['Hssss!', 'Leave me alone!', 'Grrr...'],
  },
  excited: {
    label: 'Excited', eyes: 'sparkle', anim: 'bounce', emote: 'exclaim',
    desc: 'Bursting with energy!',
    lines: ['Wheee!', 'Nyaaa!!', 'Zoom zoom!'],
  },
  proud: {
    label: 'Proud', eyes: 'happy', anim: 'bounce', emote: 'star',
    desc: 'Very pleased with themselves.',
    lines: ['Did you see that?!', "I'm the best hunter!", '*puffs chest*'],
  },
  curious: {
    label: 'Curious', eyes: 'wide', anim: 'tilt', emote: 'question',
    desc: 'Something caught their eye.',
    lines: ['Ooh?', "What's that?", '*sniff sniff*'],
  },
  cozy: {
    label: 'Cozy', eyes: 'happy', anim: 'breathe', emote: 'note',
    desc: 'If it fits, they sits.',
    lines: ['Perfect fit.', 'My box.', '*happy loaf*'],
  },
  loving: {
    label: 'Loving', eyes: 'happy', anim: 'idle', emote: 'heart', blush: true,
    desc: 'Adores you right now.',
    lines: ['I love you!', 'Purrrrr~', '*slow blink*', '*headbutt*'],
  },
  mischief: {
    label: 'Mischievous', eyes: 'sly', anim: 'idle', emote: 'exclaim',
    desc: "Up to no good. Scold them now, or they won't learn.",
    lines: ["Wasn't me.", 'Hehehe.', '*innocent face*'],
  },
  guilty: {
    label: 'Guilty', eyes: 'sad', anim: 'still', emote: 'drop',
    desc: 'Knows they did something wrong.',
    lines: ['Sorry...', "I didn't mean to...", '*ears down*'],
  },
  hangry: {
    label: 'Hangry', eyes: 'angry', anim: 'stomp', emote: 'fish',
    desc: 'So hungry it has turned into rage. Feed them!',
    lines: ['FOOD. NOW.', 'Feed me, human!', 'MRAOW!'],
  },
  hungry: {
    label: 'Hungry', eyes: 'sad', anim: 'idle', emote: 'fish',
    desc: 'Tummy is rumbling.',
    lines: ["I'm hungry...", 'Is it dinner time?', '*stares at the fridge*'],
  },
  sleepy: {
    label: 'Sleepy', eyes: 'half', anim: 'idle', emote: 'moon',
    desc: 'Running out of energy. Time for bed?',
    lines: ['*yaaawn*', 'So sleepy...', 'Five more minutes...'],
  },
  lonely: {
    label: 'Lonely', eyes: 'sad', anim: 'still', emote: 'cloud', tears: true,
    desc: 'Has been missing you. Spend some time together.',
    lines: ['Where did you go?', 'Pay attention to me...', '*sad meow*'],
  },
  sad: {
    label: 'Sad', eyes: 'sad', anim: 'still', emote: 'cloud', tears: true,
    desc: 'Several needs are very low.',
    lines: ['*sniff*', "Nobody cares about me...", 'Mew...'],
  },
  grubby: {
    label: 'Uncomfortable', eyes: 'half', anim: 'idle', emote: 'drop',
    desc: 'Feeling dirty. A brush, a bath or tidying up will help.',
    lines: ['Ew, it stinks in here!', 'My fur is a mess.', 'Could you tidy up?'],
  },
  bored: {
    label: 'Bored', eyes: 'half', anim: 'idle', emote: 'dots',
    desc: 'Needs something to do.',
    lines: ["I'm bored...", 'Play with me!', '*sigh*'],
  },
  playful: {
    label: 'Playful', eyes: 'sparkle', anim: 'bounce', emote: 'yarn',
    desc: 'Full of beans and wants to play!',
    lines: ['Play with me!', "Let's play!", '*pounce*'],
  },
  happy: {
    label: 'Happy', eyes: 'normal', anim: 'idle', emote: 'note',
    desc: 'All is well in the world.',
    lines: ['Nya~', 'Life is good.', 'Like my hat?', '*kneads the floor*', '*stretches*'],
  },
  content: {
    label: 'Content', eyes: 'normal', anim: 'idle', emote: null,
    desc: 'Doing fine.',
    lines: ['Meow.', '*tail swish*', '*looks around*'],
  },
};

export function setTemp(id, seconds) {
  S.temp = { id, until: Date.now() + seconds * 1000 };
}
export function clearTemp() { S.temp = null; }
export function tempMood() {
  if (S.temp && Date.now() < S.temp.until) return S.temp.id;
  S.temp = null;
  return null;
}

export function moodId() {
  if (S.asleep) return 'sleeping';
  const temp = tempMood();
  if (temp && (!S.sick || temp === 'scared' || temp === 'annoyed')) return temp;
  if (S.sick) return 'sick';

  const low = NEEDS.filter((k) => S[k] < 25).length;
  if (S.hunger < 15 && trait('greedy') > 0.2) return 'hangry';
  if (low >= 2) return 'sad';
  if (S.hunger < 25) return 'hungry';
  if (S.energy < 20) return 'sleepy';
  if (S.t - S.lastCare > lonelyAfter()) return 'lonely';
  if (S.clean < 25 || S.poops >= 2) return 'grubby';
  if (S.fun < 30) return 'bored';

  const avg = NEEDS.reduce((a, k) => a + S[k], 0) / NEEDS.length;
  if (S.energy > 70 && S.fun < 80 && trait('playful') > 0.25) return 'playful';
  if (S.bond >= 70 && avg >= 55) return 'loving';
  if (avg >= 65) return 'happy';
  return 'content';
}

export const mood = () => MOODS[moodId()];
