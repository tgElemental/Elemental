# عناصر / Elemental — Telegram HTML5 Game

An independently branded, Persian-first **Telegram HTML5 Game** with interactive PixiJS graphics and a serverless authoritative game engine. This is **not** a Telegram Mini App. The native Telegram game message and `Play` button are powered by `sendGame` and `answerCallbackQuery`.

**Version 0.2 • implementation-ready, not yet publicly launched**. Never claim production rollout before BotFather registration, Webhook setup, Cloudflare deployment and a real Telegram smoke test.

## Components

| Component | Purpose | Host |
|---|---|---|
| `apps/web/` | Original canvas arena, touch/drag, particles, battle UI, honest browser practice mode | GitHub Pages + Vite + PixiJS + GSAP |
| `worker/` | Telegram native Game webhook, signed one-hour launch tickets, account state, server-calculated rounds and scores | Cloudflare Workers + D1 |
| `apps/web/engine.js` | Original four-element cycle with daily affinity, streak and synthesis | Shared pure JS |
| `tests/` | Battle, authentication, D1, deployment and Telegram Game flow tests | GitHub Actions |
| `tgcloud/` | Retained legacy Serverless Mini App handler for reference, not active in Game release | Not deployed |

**Zero paid server**: Workers Free and D1 Free have quotas; don't assume infinite free capacity. Game state is D1-authoritative, never browser-authoritative.

## Rules and features

Water defeats fire, fire defeats earth, earth defeats wind, wind defeats water. A win earns 3 points, draw 1. Water+earth creates a tree and fire+wind produces light, regardless of the winner. The world changes daily with one favored element. Win streaks grant bonus points. Five free units of each element are granted daily, invitations grant bonus units once to the inviter, and ranked weekly scores are stored in D1. The bot updates the native Telegram game scoreboard with validated server scores.

## Local commands

```sh
npm install
npm run dev:web
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npm run build:web
```

Run Vite in an ordinary browser for **practice only**. Real Telegram scoring is possible only through the bot's callback-issued Game ticket. The ticket never carries a BOT_TOKEN and is removed from URL history on startup.

## Configure native Telegram Game

Follow **[the complete Game deployment guide](docs/TELEGRAM_GAME.md)**. The summary:

1. BotFather `/newgame` with Game short name matching `GAME_SHORT_NAME` (default `elemental`) and URL `https://tgelemental.github.io/Elemental/`.
2. Cloudflare Worker secret `BOT_TOKEN` (already used in v0.1) and **new** `TELEGRAM_WEBHOOK_SECRET`; deploy D1 migration `0002_pending_invites.sql` and Worker.
3. GitHub Pages Actions variable `ELEMENTAL_API_BASE` is optional if the checked-in `apps/web/config.js` is correct; otherwise set it to the Worker HTTPS origin. Deploy the built `dist/` using Pages workflow.
4. Run `scripts/register-game-webhook.mjs` locally with the BotFather API token and matching webhook secret. Do not deploy the old `tgcloud` handler for the same bot in parallel: only one update consumer owns the bot webhook.
5. Send `/game` to the bot and test native Play, scores, referrals, group chats, and browser practice. Then conduct a private beta before public promotion.

Review `docs/ARCHITECTURE.md` and `docs/TELEGRAM_GAME.md` before production.

## Non-goals of this change

No new real-money/token payouts, crypto wallets, Stars payment flow, complex PvP matchmaking, anti-Sybil guarantees or live weekly reward distribution. These need a separately reviewed product/economy and abuse prevention policy.
