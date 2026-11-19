<div align="center">

# Waleed's Clover

**A minimal, dark-mode streaming web app dedicated exclusively to *Black Clover* Season 1 (Episodes 1–170) — built for Walid.**

</div>

## Screenshots

| Welcome Screen | Theater Player & Arabic CC | Story Arcs & Episode Grid | 
| ----- | ----- | ----- | 
|  |  |  | 

## Features

* **Personalized Welcome Curtain**: Greets Waleed on every visit with time-of-day messaging, rotating *Black Clover* quotes, live Season 1 progress (`X / 170`), and one-click **Resume Episode**.

* **Season 1 Exclusive (Episodes 1–170)**: Fetches official episode metadata from **Jikan API v4** via a server-cached `/api/episodes` route, stores it in `localStorage` for instant repeat loads, and includes a built-in 170-episode offline fallback.

* **3 Working Stream Servers**: One-click switching between **Server 1 (Primary Sub)**, **Server 2 (MAL Mirror)**, and **Server 3 (English Dub)** via AnimeEmbed (`AniList: 97940` / `MAL: 34572`), with in-player clutter hidden.

* **Synced Arabic & English Subtitles (Ep 1–170)**: Dual-provider subtitle engine (`/api/subtitles`) querying **SubtitleCat** and **OpenSubtitles v3**, with automatic English-to-Arabic translation and RTL punctuation normalization so every episode supports **Arabic CC**, **English CC**, and **Off**.

* **Subtitle Style & Timing Controls**: Customize subtitle **Size** (`S / M / L / XL`), **Background** (`None / Subtle / Box`), **Color** (`White / Yellow`), **Position** (`Low / Standard / High`), and **Timing Sync** (`±0.5s`), plus a custom **Fullscreen** mode that keeps Arabic captions visible.

* **Story Arc Filters & Search**: Filter all 170 episodes by official Season 1 story arcs, search by episode number or title, hide filler episodes, or view favorites.

* **Zero-Backend Persistence**: Automatically saves last watched episode, timestamp/status, watched checkmarks, favorites, preferred server, and subtitle styling in browser `localStorage`.

## Story Arcs Covered

| Story Arc | Episodes | 
| ----- | ----- | 
| **All Episodes** | `1–170` | 
| **Magic Knights Entrance & Dungeon** | `1–19` | 
| **Royal Capital & Eye of the Midnight Sun** | `20–39` | 
| **Seabed Temple & Witches' Forest** | `40–65` | 
| **Royal Knights Selection** | `66–84` | 
| **Elf Reincarnation Arc** | `85–129` | 
| **Heart Kingdom & Spade Raid** | `130–170` | 

## Tech Stack

| Layer | Technology | 
| ----- | ----- | 
| **Framework** | Next.js 15 (App Router) | 
| **UI & Styling** | React 19, TypeScript, Tailwind CSS | 
| **Icons** | Lucide React | 
| **Episode Metadata** | Jikan API v4 + `localStorage` cache | 
| **Subtitles** | SubtitleCat + OpenSubtitles v3 (`/api/subtitles`) | 
| **Persistence** | Browser `localStorage` | 
| **Deployment** | Vercel | 

## Project Structure

```
waleeds-clover/
├── screenshots/
│   ├── 01-welcome.png
│   ├── 02-player-arabic-cc.png
│   └── 03-episodes-arcs.png
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── episodes/route.ts
│   │   │   └── subtitles/route.ts
│   │   ├── globals.css
│   │   ├── icon.svg
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── EpisodeFilters.tsx
│   │   ├── EpisodeGrid.tsx
│   │   ├── FiveLeafLogo.tsx
│   │   ├── GreetingOverlay.tsx
│   │   ├── HeroBanner.tsx
│   │   ├── Navbar.tsx
│   │   ├── VideoPlayer.tsx
│   │   └── WaleedsCloverApp.tsx
│   ├── lib/
│   │   ├── arcs.ts
│   │   ├── jikan.ts
│   │   ├── servers.ts
│   │   ├── storage.ts
│   │   └── subtitles.ts
│   └── types/
│       └── anime.ts
├── next.config.ts
├── tailwind.config.ts
└── package.json

```

## Run Locally

```
npm install
npm run dev

```

Open `http://localhost:3000` in your browser.

## Deploy to Vercel

1. Push the repository to GitHub.

2. Import it in [Vercel](https://vercel.com/new) with the default **Next.js** preset.

3. Click **Deploy** — no environment variables or external database are required.

---

## License & Copyright

© 2026 [Ziad Karem (@ziadkarem00)](https://github.com/ziadkarem00). All rights reserved.
