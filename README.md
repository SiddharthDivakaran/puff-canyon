# Puff Canyon

A one-touch browser arcade game. Hold to inflate and rise; release to shrink and fall.

## Version 3

- Every level has 10 gates, increased from 5. Bonus points never advance the level counter.
- Elastic balloon animation: up to 13% vertical stretch while holding and gentle squash while falling. All cosmetic skins share the same forgiving circular collision radius.
- Sharp synthesized pop sound on collision, six level palettes, four shuffled burst effects, and ten failure messages. Adjacent repetitions are avoided even across shuffle cycles.
- Pass a gate with under 8 logical canvas pixels of minimum clearance to earn +2 Close Shave points, once per gate. Shielded crossings do not receive this bonus. Floating text is used instead of a screen flash.
- Gentle moving gates appear from level 2; marked updraft/downdraft zones from level 3. Movement is bounded away from the ceiling and floor.
- Collect helium drops to equip Bubble (20), Foil star (40), or Hot air (60). Classic is free. Helium is earned in gameplay, has no cash value, and is stored only on the current browser/device.
- One rewarded revive per run: successful completion begins a frozen 3-second countdown followed by a 2-second collision shield. Assisted runs cannot overwrite the unassisted gate record.
- One rewarded 3x helium claim per run, adding twice the helium collected at claim time. Cancelled, skipped, failed, unavailable, or duplicate requests grant no bonus.
- Forced interstitials are eligible only on restart after every fifth completed attempt and at least 120 seconds of active gameplay since the last successful ad. There are no forced level-end ads.

## Ad integration status

**No real advertising network is connected. No ads are currently served and no revenue is generated.** Reward buttons are visibly unavailable until an approved provider reports availability. No fake ad timer grants rewards.

`dist/ads.js` defines the provider adapter contract. Replace its no-op implementation with the approved network SDK integration:

- `isAvailable(kind)` returns a synchronous boolean for `revive`, `helium`, or `interstitial`.
- `showRewarded(kind, {signal})` resolves `{completed:true}` only after the SDK's reward-earned callback. Skips, no-fill, cancellations, and errors must resolve without completion.
- `showInterstitial({signal})` resolves `{shown:true}` after an actually shown ad closes.
- Honor cancellation via `signal`, including stopping/closing any active player. The game has a 45-second timeout and a manual cancel option. Late completions cannot grant rewards.
- The advertising provider chooses video duration; a 15–30 second video is not simulated or guaranteed by the game.
- Mount an approved start-screen banner in `#landingAd` and unhide it only when filled.

Apply your network's consent and privacy requirements before enabling it. An approved account and publisher/ad-unit configuration are still needed. These local rewards are not a secure economy for a competitive or cash-valued product.

## Run locally

This web prototype uses vanilla JavaScript, Canvas, HTML, and CSS, not React Native. There are no package dependencies or build steps.

```sh
python -m http.server 8080 --directory dist
```

Open http://localhost:8080. Hold touch, Space, or Arrow Up to rise. Release to descend. Use P or Escape to pause/resume. Audio begins after a user gesture; mute preference is saved on the device.

## Deploy with Cloudflare Pages

Import this GitHub repository into Cloudflare Pages:

| Setting | Value |
| --- | --- |
| Production branch | main |
| Framework preset | None |
| Build command | exit 0 |
| Build output directory | dist |

Publish only `dist`. No environment variables, database, or server functions are required. The connected Pages project can automatically redeploy after main-branch pushes.

Guide: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/

## Architecture and testing

Rendering and gameplay run in each player's browser. Simultaneous visitors play independent solo runs. Best scores, helium, and skins live in localStorage and are not synchronized across browsers. Google Fonts is optional; fallback fonts are provided.

```sh
node --check dist/game.js
node --test tests/puff.test.cjs
```

Regression checks cover stage length, near-miss accounting, collectible and skin transactions, cancellation and duplicate rewards, revive countdown/shield, interstitial caps, and hazard bounds. Real-device audio, touch feel, and difficulty still require playtesting. This update does not claim measured retention improvement.
