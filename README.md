# hydrus-ui

Hydrus tag rating tool with TrueSkill-based tag analytics, Smash/Pass voting, and gallery browsing.

- **Smash/Pass** — rate files pairwise, tracks per-tag TrueSkill ratings in IndexedDB, syncs inc/dec ratings to Hydrus API
- **Analytics** — tag-level TrueSkill leaderboard with mu/sigma display
- **Search** — full Hydrus search with thumbnail grid, gallery carousel, inc/dec ELO overlay
- **Leaderboard** — top 500 files by inc/dec rating, sorted client-side
- **Favorites** — files liked on a like/dislike service

## Setup

```bash
cp .env.example .env
```

Edit `.env` to point `VITE_HYDRUS_API_URL` at your Hydrus client API (default `http://127.0.0.1:45869`).

```bash
npm install
npm run dev
```

Enter your Hydrus API access key in the Connection Settings screen on first load.

## Stack

React, TypeScript, Vite, Zustand, TanStack Query, Tailwind CSS.
