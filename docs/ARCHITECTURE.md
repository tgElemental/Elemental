# Native Telegram Game architecture, v0.2

```text
  Telegram /game or /start (private chat or group)
                    |
        Telegram Bot API sendGame
                    |
      Native Play button / Game Callback
                    |
  POST Cloudflare Worker /telegram/webhook
     verified Telegram webhook secret header
                    |
   Worker signs short-lived launch ticket with BOT_TOKEN-derived HMAC
                    |
  Bot API answerCallbackQuery(Game URL + ticket)
                    |
  GitHub Pages /Elemental/ (PixiJS Canvas + Vite bundle)
                    |
   Authorization: Bearer <signed Game ticket>
                    |
   Cloudflare Worker /api/session and /api/play
                    |
   D1 authoritative balances and game scores
                    |
    Bot API setGameScore (best-effort)
```

No `initData` is promised by Telegram for **native HTML5 Games**. The Worker validates launch tickets it issues in response to authenticated Telegram callbacks. No arbitrary `userId` in an HTTP request body authorizes gameplay. The legacy WebApp signature verifier remains available for older sessions but the new UI uses the Game protocol only.

For **one bot**, only one Bot API webhook receiver can process updates: use Worker for this version, not both Worker and Telegram Serverless. Telegram Serverless is intentionally retained only as a future integration possibility.

Each successful play is committed through a D1 INSERT-and-trigger, with per-action UUID idempotency and server-derived opponent, rewards and score. Score updates back to Telegram are best-effort after the D1 commit, so API outages cannot erase earned progress. Before scale-up, implement a retry outbox, rate limits, score sync recovery, quota monitoring, fraud detection and privacy compliance.

D1 `pending_invites` stores inviter codes delivered by genuine bot `/start ref_...` updates; referral awards are only applied when a new player first starts a valid game. Scores on the public leaderboard use pseudonymous aliases.

### Free infrastructure and deployment

- **GitHub Pages** hosts the Vite-built static HTML5 game under `/Elemental/`.
- **Cloudflare Workers + D1** hold all business logic, store game state and serve the Bot API webhook.
- **BotFather** owns the native Game short name. No separate paid server.
- The `Deploy Cloudflare API` workflow resolves the actual D1 ID from Cloudflare and runs migrations and deploys with Actions secrets.
- The `Deploy mini app to GitHub Pages` workflow (legacy workflow title) now builds and uploads the **native HTML5 game**, not the old Mini App UI.

Production domain, short name, Worker URL and bot token must be checked before enabling `setWebhook`. See `docs/TELEGRAM_GAME.md`.
