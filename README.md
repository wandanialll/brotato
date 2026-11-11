# Brotato 🐱

A tiny Tamagotchi-style virtual pet as an installable Progressive Web App.
Look after Brotato, a pixel cat in a straw hat.

No build step and no dependencies: plain HTML, CSS and JavaScript.

## Play

Brotato has needs (**Food, Joy, Energy, Clean**) that change in real time, even while the app is closed.
On top of that:

- **Personality:** every kitten gets five traits: Playful/Lazy, Cuddly/Independent, Foodie/Picky, Brave/Timid and Tidy/Scruffy. Traits change how fast needs drop and how the cat reacts to everything you do. They also get a favourite food and one they dislike.
- **Emotions:** 21 moods worked out from needs, personality, bond and recent events, including happy, loving, playful, proud, curious, cozy, excited, bored, lonely, sad, hungry, hangry, sleepy, scared, annoyed, sulking, mischievous, guilty and sick. Each mood has its own face (eyes, blush, tears, open mouth), body language, emote and lines.
- **Long-term attributes:** **Bond** (hearts) grows with care and drops with neglect. **Discipline** decides how often they misbehave. **Weight** goes up with food, down with play, and shows on the sprite.
- **Events:** knocked-over mugs and plants, scratched wallpaper, gifts (toy mice, socks, leaves), thunderstorms, butterflies, zoomies and hairballs.

### Actions

- **Feed:** fish, chicken, milk (can upset tummies) or treats (3 an hour).
- **Play:** yarn-catching mini game, feather wand, cardboard box, or catnip.
- **Care:** brush (builds bond), bath (most cats hate it), or tidy up messes.
- **Sleep / Wake:** waking them too early makes them grumpy.
- **Pet:** tap the cat. Too much petting annoys independent cats. Petting comforts a scared cat and can win back a sulking one.
- **Context buttons** appear when needed: **Give medicine**, **Praise** a gift, or **Scold** a fresh mess (it only works right after it happened).
- **ⓘ** opens the profile: traits, bond, discipline, weight, favourite foods and a diary of what has happened.

## Run locally

Any static file server works. The service worker needs `http://localhost` or HTTPS:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. To test faster, add `?speed=60` to the URL (time runs 60× faster). In the console, `brotato.setTemp('scared', 30)` forces a mood.

## Install on a phone

The app needs HTTPS. This repo includes a GitHub Pages workflow (`.github/workflows/pages.yml`):

1. Merge to `main`.
2. In the repo go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Open the Pages URL on your phone, then:
   - Android/Chrome: tap **Install Brotato** (or ⋮ → *Install app*).
   - iOS/Safari: Share → **Add to Home Screen**.

## Project layout

```
index.html            app shell
styles.css            pixel-art UI
js/main.js            UI, actions, live events
js/state.js           save data, traits, foods
js/sim.js             passage of time, offline catch-up
js/mood.js            emotion engine
js/icons.js           pixel icons
sw.js                 offline cache (bump VERSION when files change)
manifest.webmanifest  PWA manifest
assets/cat.png        character sprite (generated)
assets/source/        original character art
icons/                app icons (generated)
tools/build-assets.py rebuilds the sprite and icons from the original art
```

To regenerate the sprite and icons after changing the art (needs Pillow):

```bash
python3 tools/build-assets.py
```
