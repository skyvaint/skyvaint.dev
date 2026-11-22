# skyvaint.com

Portfolio and commission site for skyvaint, a Roblox developer. It's plain HTML, CSS and JS, plus two small serverless routes in `api/`.

## Files

| Path | What it is |
| --- | --- |
| `portfolio.js` | **All editable content**: games, UI shots, programming list, studios, tools and contact links |
| `index.html` | Page structure, pricing, FAQ and terms text |
| `assets/style.css` | Ultra Instinct × Legends-style theme |
| `assets/site.js` | Rendering, live stats, gallery, form, title screen |
| `assets/fx.js` | Synthesized sound (Web Audio, no audio files), aura particles, speed lines, cursor |
| `assets/vfx/` | Aura, ring, wing, flare, swoosh and streak overlays |
| `assets/ui/`, `assets/games/`, `assets/brand/` | UI gallery, saved Roblox thumbnails and icons, avatar and favicon |
| `api/stats.js` | `GET /api/stats?ids=…`: live Roblox players, visits, favorites and likes, cached for 60s |
| `api/commission.js` | `POST /api/commission`: validates the form and posts it to the Discord webhook |
| `dev_server.py` | Local preview that imitates both routes |

## Edit content

- **Games**: add an entry to `games` in `portfolio.js` with its `universeId` and `placeId`. Live numbers come from Roblox; `snapshot` is shown only when Roblox can't be reached. Save thumbnails as `assets/games/<universeId>-1.webp` (up to `-3`) and the icon as `-icon.webp`.
- **Trailers**: set `trailer` to an `.mp4`/`.webm` in `assets/` (it plays muted on the card) or to a YouTube link (it plays in the details view).
- **UI**: drop images in `assets/ui/` and append them to `ui`.

## Discord webhook (commission form)

The site is served by GitHub Pages, which can't keep secrets, so the form posts to Discord straight from the visitor's browser.

- The real URL lives only in `.env`, which is git-ignored.
- `python build_relay.py` writes a **scrambled** copy to `assets/relay.js`. It isn't plain text, so leak scanners don't delete the webhook, but it is obfuscation, not security.
- The browser allows 3 sends per 10 minutes, and the form has a hidden spam trap.
- **If the webhook gets spammed:** delete it in Discord, create a new one, put it in `.env`, run `python build_relay.py`, then commit and push.
- If the site ever moves to Vercel, `api/commission.js` is used instead and keeps the webhook fully server-side. Set `DISCORD_WEBHOOK_URL` in Vercel. The form tries `/api/commission` first and falls back to the relay.

## Run locally

```
python dev_server.py --live   # http://localhost:8417 — the form really posts to your Discord
python dev_server.py          # same, but the form is a dry run and only prints
```

## Deploy

Commit and push to `main` of `skyvaint/skyvaint.dev`. GitHub Pages publishes it to skyvaint.com within a minute or two. Keep the `CNAME` file.
