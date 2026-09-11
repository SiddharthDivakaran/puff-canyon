# Puff Canyon — Journey edition

A hold-to-rise browser game with 100 fixed courses, 20 gates per course, 10 colorful worlds, wind currents, moving gates, near-miss points, helium and cosmetic skins. Rendering and physics run entirely in each visitor's browser.

## Play modes

- **Journey:** clear levels to unlock the next checkpoint. Replay unlocked levels from the map. Progress, helium and skins are device-local.
- **Ranked flight:** begins at level 1, with no revives. The server assigns a public flyer name. On failure or clearing level 100, the best result for that browser identity is saved. The shared board ranks gates first, then points; an earlier score wins an exact tie. No invented/sample scores.
- Every level ends after exactly 20 cleared gates; bonus points never advance levels. There are exactly 100 levels and a completion screen after gate 2,000.

`dist/levels.js` defines ten route recipes with world-specific direction, phase, gap, motion, speed, wind and colors. It creates 100 unique, reproducible course configurations. These are procedural course variants, not 100 individually hand-playtested layouts. The first world introduces hazards gently; speed rises from 132 to 221 logical px/s across the campaign, initial gap narrows from 240 to about 173 px, and every five gates adds a small ramp. First-level winds are at gates 8, 14 and 19.

## Public deployment: Cloudflare Workers Builds

This repository is connected to the existing `puff-canyon` Cloudflare Worker. `wrangler.jsonc` now adds the API entrypoint and a SQLite-backed Durable Object. The first successful deployment provisions the leaderboard automatically; there is no database ID or secret to paste.

- Build command: `exit 0` (plain authored static files).
- Deploy command: `npx wrangler deploy` (the existing `--assets dist` argument is also compatible).
- Do not deploy only the `dist` folder via Pages: that serves the game but omits the shared API.
- Do not use `wrangler versions upload` for the first migration; use `wrangler deploy`.
- If Cloudflare's existing build token cannot create a Durable Object namespace, update that build integration's permissions in Cloudflare and retry. Do not put credentials in this repository.

SQLite-backed Durable Objects are available on Cloudflare's Free plan, subject to account-wide daily request, duration, read/write and storage limits. The game remains a static browser application; the API is used only when opening the leaderboard, beginning a ranked run, or posting its result. There are no persistent sockets or per-frame server requests.

The separate private ChatGPT Sites copy publishes `dist` only. Journey mode works there; the shared leaderboard belongs to the public Cloudflare deployment. Its UI reports unavailability if the API is absent instead of showing fake local scores.

## Leaderboard behavior and limits

`worker/index.mjs` owns the API and persistent SQL tables. It uses a random HttpOnly, Secure, SameSite cookie, generated public aliases, one-use run sessions, same-origin writes, bounded scores, elapsed-time plausibility checks, request limits, parameterized SQL and an index for ranking. Sessions expire after 24 hours; cleanup occurs on a subsequent run start. Score submissions are idempotent and only improve an existing record.

This is a casual leaderboard, not cheat-proof competition. Gameplay still runs client-side; a determined player can forge plausible input after waiting. Server replay verification is needed before prizes or valuable rewards. Browser identities are not accounts: clearing cookies or using another browser creates a new player. Best scores do not synchronize across devices. The data notice is at `dist/privacy.html`.

## Ads

No advertising SDK, publisher ID, paid subscription or fabricated ad is shipped. `dist/ads.js` is the existing provider contract; unavailable ads cannot grant rewards. Journey revives are limited to once per run, with a 3-second countdown and 2-second shield. Ranked runs cannot revive. The helium bonus is claimable once. Interstitial eligibility requires every fifth completed attempt AND at least 180 seconds of active play since the last successful ad. Ads never interrupt flying.

A selected ad network still needs approval, its own SDK adapter, production credentials/configuration, and the appropriate consent/privacy implementation. Portal SDKs are not interchangeable. Keep ads disabled until that integration is complete. Do not add a guessed ads.txt publisher entry.

## Validation

```sh
node --check dist/game.js
node --check dist/levels.js
node --check worker/index.mjs
node --test tests/puff.test.cjs tests/leaderboard.test.mjs
npx wrangler deploy --dry-run
```

Node 22+ with `node:sqlite` is required for backend tests. The suite covers all 100 levels, unique layouts, hazard bounds, completion, checkpoint restart, wind displacement, scoring, currencies, reward cancellation, revive rules, ad caps and real SQLite leaderboard requests, duplicates, rejected submissions and ranking indexes. No browser/device playtesting or retention measurement is claimed.

## Monetization decision (September 2026)

Start with [CrazyGames Basic Launch](https://docs.crazygames.com/resources/basic-launch-metrics/) to measure audience response; ads are disabled at this stage. Monetization requires selection for Full Launch and SDK integration. [Poki](https://developers.poki.com/guide/working-with-poki) is curated and asks for web exclusivity, so do not assume you can publish the same build everywhere. Keep self-hosting for direct sharing and consider [Google H5 Games Ads](https://adsense.google.com/start/h5-games-ads/) when you have your own audience. Approval is discretionary; a workers.dev rejection is not established by Google's general eligibility documentation.

The quoted $2–10 eCPM is a hypothetical range, not a forecast. At 2,000 filled impressions that is $4–20/day before any applicable share/deductions, not necessarily single-digit dollars. Actual geography, fill, format and revenue terms determine receipts. Apps can come later: [Google Play](https://support.google.com/googleplay/android-developer/answer/6112435) lists a US$25 registration fee; [Apple](https://developer.apple.com/programs/enroll/) lists US$99 per year, with local variation. Higher app ad revenue is not guaranteed.
