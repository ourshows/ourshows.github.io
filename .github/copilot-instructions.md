<!-- Copilot instructions for repo-specific behaviours -->
# OurShow — Copilot Instructions

Short, actionable guidance for AI coding agents working on this repository.

**Big Picture:**
- **Type:** Static frontend single-page app (no build tool). Files are plain HTML/CSS/JS served as static assets.
- **Primary responsibilities:** `index.html` (UI shell), `config.js` (external API helpers & keys), `main.js` (SPA logic, TMDB integration, rendering), `community.js` (Firebase realtime chat), and small pages (`ai.html`, `watchlist.html`, etc.).

**Key patterns & architecture:**
- `config.js` exports `API_CONFIG`, `tmdbFetch`, `tmdbFetchWithKey`, and `geminiCall`. Use `tmdbFetch(...)` for all TMDB calls — it handles token fallback to the API key.
- `main.js` defines `SECTIONS` (section id, title, TMDB endpoint, type) and uses `addPageParam(endpoint, page)` to add `page=` safely. Refer to `SECTIONS` to add/remove homepage rows.
- Firebase is optional: code prefers `window.db` / `window.auth` if present, otherwise falls back to `localStorage`. Local keys used:
  - `ourshow_watchlist` — object map of `{tmdbId: {title, time}}`
  - `ourshow_watchlater`
  - `ourshow_reviews`
  - `ourshow_username`
- Realtime DB paths observed:
  - `users/{userId}/watchlist/{tmdbId}` and `users/{userId}/watchlater/{tmdbId}` (writes in `main.js`)
  - `ourshow/reviews/{id}` (reviews push)
  - `globalChat` and `typing` (used by `community.js`)

**File load order & important DOM assumptions:**
- `index.html` intentionally loads `firebase-config.js` first, then `config.js`, and finally `main.js` (deferred). Ensure scripts keep that order — `main.js` expects `API_CONFIG` and `tmdbFetch` to exist and `firebase-config.js` to optionally provide `window.db`/`window.auth`.

**Developer workflows (discoverable commands):**
- There are no npm scripts defined. To serve locally use a simple static server (examples):
  - `npx http-server -c-1 .` (uses `http-server` via `npx`)
  - `python -m http.server 3000` (Python installed)
- `package.json` only lists `firebase` as a dependency — not required to run the static site in-browser.

**When editing or extending:**
- To add a new homepage section, update `SECTIONS` in `main.js`. Use `endpoint` values compatible with TMDB (no `page` param — `addPageParam` will add paging).
- When calling TMDB, always use `tmdbFetch(...)` to get automatic token -> api_key fallback and consistent JSON error handling.
- For features that persist data, prefer existing Firebase paths when the app is running with Firebase; otherwise, keep using the `localStorage` keys above to preserve behavior and tests.

**Security & configuration notes:**
- `config.js` currently contains API keys and a read-access TMDB token. Treat these as secrets: do not add new secrets or commit additional private keys. If you need to change keys, update `config.js` or prefer environment-backed injection for production builds.

**Examples to reference when editing code:**
- Use `makeCard(item, type)` in `main.js` when producing grid items — it centralizes markup and placeholder logic.
- Use `openModal(id, type)` in `main.js` for detail-modal content and how `append_to_response=videos,credits,similar` is requested.
- Chat/typing handling is in `community.js` (`db.ref('globalChat')`, `db.ref('typing')`). Follow these paths for integrating chat features.

**What NOT to change without verification:**
- Script load order in `index.html` (see above). Breaking order causes runtime errors.
- The fallback localStorage keys and Firebase DB paths — changing them requires migration code to preserve user data.

If anything here is unclear or you want more examples (e.g., exact DOM ids, sample TMDB endpoints from `SECTIONS`, or firebase-config details), tell me which area to expand and I will iterate.
