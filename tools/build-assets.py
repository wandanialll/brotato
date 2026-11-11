"""Build the cat sprite and PWA icons from the original character art.

Usage: python3 tools/build-assets.py
Requires Pillow.
"""
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/source/brotato-original.webp"
BG = (255, 233, 196, 255)  # warm cream, matches the app's background


def is_background(c):
    r, g, b, a = c
    return a < 128 or (r > 235 and g > 235 and b > 235)


def extract_sprite():
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.extend(((x, 0), (x, h - 1)))
    for y in range(h):
        q.extend(((0, y), (w - 1, y)))
    # flood-fill the outer white/transparent area to transparent
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if not is_background(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    # crop to the drawn character (ignores faint specks left by the generator)
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 200 and not (r > 230 and g > 230 and b > 230):
                xs.append(x)
                ys.append(y)
    pad = 4
    im = im.crop((min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad))
    cw, ch = im.size
    s = max(cw, ch)
    sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sq.paste(im, ((s - cw) // 2, s - ch))
    return sq


def icon(sprite, size, scale, out, bg=BG):
    canvas = Image.new("RGBA", (size, size), bg)
    inner = int(size * scale)
    cat = sprite.resize((inner, inner), Image.LANCZOS)
    off = (size - inner) // 2
    canvas.alpha_composite(cat, (off, off))
    canvas.save(out)


def main():
    sprite = extract_sprite()
    sprite.resize((512, 512), Image.LANCZOS).save(ROOT / "assets/cat.png")
    icons = ROOT / "icons"
    icons.mkdir(exist_ok=True)
    icon(sprite, 192, 0.84, icons / "icon-192.png")
    icon(sprite, 512, 0.84, icons / "icon-512.png")
    icon(sprite, 512, 0.62, icons / "maskable-512.png")
    icon(sprite, 180, 0.80, icons / "apple-touch-icon.png")
    icon(sprite, 32, 1.0, icons / "favicon-32.png", bg=(0, 0, 0, 0))
    print("assets written")


if __name__ == "__main__":
    main()
