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

## Hotkeys

| Key | Context | Action |
|---|---|---|
| `a` / `ArrowLeft` | Smash/Pass | Choose left |
| `d` / `ArrowRight` | Smash/Pass | Choose right |
| `Space` / `s` | Smash/Pass | Draw |
| `a` / `d` / `ArrowLeft` / `ArrowRight` / `j` / `k` | Gallery | Previous / next file |
| `w` | Gallery | Toggle like on like/dislike service |
| `Home` | Gallery | First file |
| `End` | Gallery | Last file |
| `i` | Gallery | Toggle file info panel |
| `Escape` | Gallery / Global | Close gallery |
| `ArrowRight` / `ArrowDown` | Search grid | Select next file |
| `ArrowLeft` / `ArrowUp` | Search grid | Select previous file |
| `Enter` | Search grid | Open selected file in gallery |

All hotkeys are suppressed when typing in a text input (tag search bar).

## Stack

React, TypeScript, Vite, Zustand, TanStack Query, Tailwind CSS.
