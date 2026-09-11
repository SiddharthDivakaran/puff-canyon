# Puff Canyon

A one-touch browser arcade game. Hold to inflate and rise; release to shrink and fall. Every five cleared gates advances a level.

## Latest version

- Six colourful stage palettes.
- Four shuffled balloon-burst effects and ten shuffled failure messages, including retries within the same level.
- Start, scoring, level-up, and failure sound effects. Audio begins after a user gesture; a mute toggle saves the device preference.
- Start-screen and level-break advertisement placement previews. These are not real ads and generate no revenue; an approved ad-network integration is still required.
- Device-local personal best. No purchases, accounts, shared leaderboard, or real-time multiplayer.

## Run locally

This prototype uses vanilla JavaScript, Canvas, HTML, and CSS, not React Native. No dependency installation or build is required.

```sh
python -m http.server 8080 --directory dist
```

Open http://localhost:8080. Hold the screen, Space, or Arrow Up to rise. Release to descend. Use P or Escape to pause/resume.

## Deploy with Cloudflare Pages

Import this GitHub repository into Cloudflare Pages:

| Setting | Value |
| --- | --- |
| Production branch | main |
| Framework preset | None |
| Build command | exit 0 |
| Build output directory | dist |

No environment variables or backend functions are required. Cloudflare provides a pages.dev address. Publish only the dist folder.

Deployment guide: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/

## Architecture

All gameplay, rendering, and physics run in each visitor's browser. Hosting serves static files. Independent players can play simultaneously without a game server. Scores are stored in localStorage and are not suitable for trusted competitive rankings without server validation. Google Fonts is optional; fallback fonts are included.

## Validation

JavaScript syntax and scripted checks passed for movement, collisions, scoring, pause/resume, level breaks, restart, shuffled failures at level 1, and audio triggers. Real-device audio output, visual behaviour, and difficulty still need playtesting.
