# Waleed's Clover — Black Clover Season 1 (Episodes 1–170)

A minimal, dark-mode streaming web application dedicated exclusively to **Black Clover Season 1 (Episodes 1–170)** — built for **Walid** with Next.js App Router, TypeScript, Tailwind CSS, and Lucide React.

## Highlights

- **Minimal Cinema Dark Theme**: Matte obsidian (`#09090B`) and charcoal (`#111114`) surfaces, hairline borders, a monochrome + crimson Five-Leaf Clover mark, and a custom browser tab favicon (`src/app/icon.svg`).
- **Greeting Page on Every Visit**: Clean full-screen welcome curtain with time-of-day greeting, Season 1 progress bar, and instant resume.
- **English UI with English CC / Arabic CC Switcher**: 100% English interface with a built-in **English CC / Arabic CC** selector and 5 verified embed servers (VidPlus & VidLink for multi-language EN/AR captions, plus AnimeEmbed AniList, MAL Mirror, and English Dub).
- **Reliable Jikan API v4 Sync**: Server-side cached `/api/episodes` route (24h revalidation + 429 retry-backoff) paired with `localStorage` caching and a 170-episode offline fallback.
- **Zero Backend Required**: Automatically persists last watched episode, timestamp/status, watched checkmarks, favorites, server choice, and CC preference in browser `localStorage`.

## Run Locally

```bash
npm install
npm run dev
```

## Push to GitHub & Deploy on Vercel

```bash
git add .
git commit -m "Redesign UI, fix embed servers and Jikan API route"
git push
```

Vercel will automatically rebuild and redeploy with no environment variables needed.
