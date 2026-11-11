# Brotato 🐱

A tiny Tamagotchi-style virtual pet as an installable Progressive Web App.
Look after Brotato, a pixel cat in a straw hat.

No build step and no dependencies: plain HTML, CSS and JavaScript.

## Play

- **Feed**: a fish dinner fills the Food bar. Treats add Joy, but only 3 an hour.
- **Play**: catch the yarn ball as many times as you can in 12 seconds.
- **Clean**: clears up messes and gives a bath.
- **Sleep / Wake**: turns the lights off. Brotato wakes up on their own once rested.
- **Meds**: shows up only when Brotato is sick.
- **Tap the cat** to pet them. **Tap the name** to rename.

Time runs in real time, even while the app is closed (the game catches up for up to 3 days).
If stats get low or messes pile up, Brotato can get sick.

## Run locally

Any static file server works. The service worker needs `http://localhost` or HTTPS:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. To test faster, add `?speed=60` to the URL (time runs 60× faster).

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
app.js                game state, simulation, actions, pixel icons
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
