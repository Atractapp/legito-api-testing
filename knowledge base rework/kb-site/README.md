# Legito KB 2026 — unofficial preview site

Static site generated from the KB2026 rework (`../KB2026/md`), with screenshots and video
guides carried over from the current live Knowledge Base.

- `build.mjs` — the generator. Run `npm install && node build.mjs`; output lands in `dist/`.
- `data/live_map.json` — per-article map of live-KB media (images, Vimeo embeds); produced by `scripts/build_live_map.py`.
- `data/vimeo_posters.json` — Vimeo poster thumbnails + titles (Vimeo oEmbed).
- `scripts/` — the scrapers that produced `data/` and `public/live/` from www.legito.com.
- `public/live/` — 593 screenshots + posters downloaded from the live Knowledge Base.
- `src/` — styles (Legito Brand Guidelines 2023, closed palette) and client JS (search palette, lightbox, video facades).

Rebuilding requires the KB2026 article set at `../KB2026/md` (not in this repo).

Deployed to Vercel (team atracts-projects) as a static deploy of `dist/`:
`cd dist && vercel deploy --prod`. The site is `noindex` everywhere and carries a permanent
"Unofficial preview" banner.
