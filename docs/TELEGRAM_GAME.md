# Elemental v0.2 · Telegram HTML5 Game (not a Telegram Mini App)

## Why the handler moved to Cloudflare Worker

Telegram's classic Game callbacks **do not provide** signed Mini App `initData` to the HTML5 browser. The old `tgcloud/handlers/message.js` emits a Mini App button and is **not** suitable for the Game login flow. In this release, the **Cloudflare Worker** is the serverless bot webhook and the authoritative game API. It receives Telegram `message` and `callback_query` updates, creates a short-lived HMAC ticket bound to the Telegram user and game message, and answers the callback with the Pages URL plus the ticket. The Worker also posts server-computed scores back through `setGameScore`.

**Do not deploy Telegram Serverless and a separate Worker webhook as competing consumers for the same Bot API token.** If you want tgcloud to become the sole receiver later, we need a documented secure key/credential bridge from Telegram Serverless to D1; it must not be simulated with client-provided Telegram IDs. The legacy Telegram Serverless deployment workflow intentionally refuses to deploy in this Game release.

## BotFather owner steps (required once)

1. Open @BotFather, choose the Elemental bot and issue `/newgame`.
2. Register the HTML5 Game with **the exact short name configured as `GAME_SHORT_NAME`** in `worker/wrangler.jsonc` (starter default: `elemental`).
3. Give BotFather the Game URL `https://tgelemental.github.io/Elemental/` and an image/description. Check the URL's registered domain and make sure Telegram accepts the URL returned by `answerCallbackQuery` with a unique query string.
4. Verify bot username in `apps/web/config.js`.

## One-time Cloudflare prerequisites

`BOT_TOKEN` is already your Worker secret. Add a **new** Worker secret `TELEGRAM_WEBHOOK_SECRET`:

```sh
openssl rand -hex 32  # Copy this value. Never commit it.
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET --config worker/wrangler.jsonc
```

The DB must have migration `0002_pending_invites.sql` before you enable the webhook. Deploy the Worker via GitHub Actions (`Deploy Cloudflare API`) after setting D1/Worker secrets. A successful `/health` response should have version `0.2.0-game`.

Then set up the webhook **locally only**. Run after exporting your secrets in your private shell (avoid committed .env files):

```sh
export BOT_TOKEN='<BotFather API token>'
export TELEGRAM_WEBHOOK_SECRET='<same Worker secret>'
export ELEMENTAL_API_BASE='https://elemental-api.<your-subdomain>.workers.dev'
node scripts/register-game-webhook.mjs
unset BOT_TOKEN TELEGRAM_WEBHOOK_SECRET
```

The `register-game-webhook` script sends the token to Telegram's API only. It does not print the token or secret. When switching from tgcloud, verify that the webhook points to the Worker and test commands before broad distribution.

## GitHub Pages

Set repository Actions variable `ELEMENTAL_API_BASE` to the public **origin** of your Worker (`https://...workers.dev`, no path), and run **Deploy HTML5 Game to GitHub Pages** (or merge to `main`). The action validates the URL, installs npm packages, builds Vite/PixiJS, and deploys `dist/`. No Worker API key appears in the browser bundle.

## In-Telegram smoke test

1. `/game` returns Telegram's **native Game message** with **Play**, not a Mini App button.
2. Tap Play; Telegram emits `callback_query.game_short_name` and Worker answers with a personalized ticket URL.
3. Game loads without the practice banner. Make a move, close and reopen it, confirm score/inventory persists.
4. View the message's Telegram score list, and test a game forwarded to a group as well as personal chat.
5. Share `/start ref_<invite_code>` with a second Telegram account, then Play. Ensure exactly one inviter reward and no self-referral.
6. Open the Pages URL in an ordinary browser. It should **only** run local practice mode, never persist or count as a real Telegram user.

**Security:** The browser never supplies a Telegram user ID to the API. The ticket is HMAC-signed, expires after one hour, and is stripped from browser history at startup. All balance/score mutations remain D1-authoritative. Telegram scores are posted by the Worker, not the browser. Higher-scale release requires rate limiting, retry/outbox for score synchronization, fraud/abuse controls, user reports, and quota monitoring. No real-money rewards or tokens are included.

## Official references

- https://core.telegram.org/bots/games
- https://core.telegram.org/bots/api#sendgame
- https://core.telegram.org/bots/api#answercallbackquery
- https://core.telegram.org/bots/api#setgamescore
