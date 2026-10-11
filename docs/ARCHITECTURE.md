# Architecture: no paid server

```
Telegram BotFather + Telegram Serverless message handlers
                    |
            Link to Mini App
                    v
   GitHub Pages static frontend (no API secrets)
                    |
       signed Telegram initData header
                    v
 Cloudflare Worker -- Telegram HMAC validation
                    |
           D1 (authoritative DB)
              /            \
        rounds + grants    leaderboard
```

Why not host scores in GitHub or the Mini App? Static assets and clients are fully modifiable. Scores, rewards, and economic mutations must be server-authoritative.

Why not use Telegram Serverless SQLite as well? Avoid two ledgers or cross-service 2-phase commits. Telegram's new Serverless runtime is used for bot events and menu integration; D1 owns the only gameplay ledger, preserving cloud vendor portability. Hosting the Mini App on Telegram is an optional future experiment.

### Cloudflare free ceilings (as of 2026-10)

- Workers Free: 100,000 requests per day, 10ms CPU per HTTP request.
- D1 Free: 5,000,000 rows read/day, 100,000 rows written/day and a 500MB maximum database size per database.
- When D1 daily quotas are exceeded operations fail until reset. No unlimited promise; test at expected load.

### Security and abuse model

- Never use user IDs from a request body or `initDataUnsafe` to authorize mutations; server verifies signed Telegram init data and its age (currently 1h).
- `start_param` used for referral must be the Telegram-signed value, not a request-body override.
- An unpredictable idempotency action ID is unique in `rounds` for retries; SQL inserts only when player has inventory.
- D1 triggers apply reward/debit atomically. `grants` event keys protect against double daily/referral credits.
- Anonymous aliases on leaderboard (do not expose Telegram identifiers).
- Limit `.env`, GitHub secrets, Worker secret `BOT_TOKEN`, and Serverless credentials strictly.
- Additional abuse controls needed before public launch: rate limiting, Sybil/referral abuse detection, support/moderation, GDPR/retention, fraud monitoring.

### Availability caveats

GitHub Pages is static hosting, not an application backend. Telegram can block or change experimental capabilities. Worker and D1 free-tier hard limits mean the system should fail closed on writes and surface a user-friendly outage message. Use Cloudflare Analytics/Observability free features and Telegram Serverless status/logs.
