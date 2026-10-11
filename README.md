# عناصر — چرخهٔ جهان / Elemental

A distinct, RTL-first Telegram Mini App with a no-VPS backend.

**Status: runnable pre-launch foundation**, not a production deployment.

## Components

| Part | Host | Path |
|---|---|---|
| Original mobile-first Mini App and shared game engine | GitHub Pages | `apps/web/` |
| Authoritative state, referral/daily rewards, leaderboard, Mini App HMAC verification | Cloudflare Worker + D1 | `worker/` |
| `/start`, `/game`, `/help` | Telegram Serverless | `tgcloud/` |
| Tests and site deployment | GitHub Actions | `.github/workflows/` |

There is no VPS, Docker, or paid database requirement. Free tiers have **hard quotas**; an infinitely replayable game is not unlimited hosting capacity.

## What works in the starter

- A dedicated identity: original compass-of-four-forces logo, dark nautical palette, distinct element symbols.
- A usable mobile web UI with four elemental cards, map, codex, weekly leaderboard, and Telegram haptics.
- Honest browser practice mode; state/prizes are never persisted in practice.
- Old victory and synthesis rules restored from `jaavid/elementalgame` plus rotating daily weather affinity and winning streak bonuses.
- Telegram Mini App `initData` HMAC-SHA256 verification on Worker; no trust in `initDataUnsafe` for account identity.
- D1 SQL triggers guarantee atomic rounds: idempotent action IDs, inventory decrements, points, tree/light synthesis, weekly scores.
- Once-per-day free elements and exactly-once inviter reward for new player registration via Telegram-signed start parameter.

## Quick local demo (no tokens)

```bash
python3 -m http.server 8000 --directory apps/web
# Open http://localhost:8000
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

## Publish to the existing organization repository

GitHub repository: [`tgElemental/Elemental`](https://github.com/tgElemental/Elemental).

The starter is not deployed merely because the repository exists. Import the extracted project into a reviewable branch and open a PR using the authenticated GitHub CLI:

```bash
# In the unzipped `elemental/` folder:
chmod +x scripts/publish-to-github.sh
./scripts/publish-to-github.sh
```

You must have push access via `gh auth login`. Alternatively, grant the ChatGPT GitHub App write access to the new repository under the organization's Installed GitHub Apps → Configure → Repository access; otherwise connector writes may return `403 Resource not accessible by integration` even when public source can be read.

After the PR is merged, go to repository **Settings → Pages → Build and deployment**, select **GitHub Actions**. The `pages.yml` workflow publishes `apps/web/` on a matching `main` push. The expected Pages URL is `https://tgelemental.github.io/Elemental/` (repository name uses uppercase E).

## Cloudflare D1 and Worker

```bash
npm install
npx wrangler login
npm run db:create
# Paste generated `database_id` into worker/wrangler.jsonc.
# This is a *public resource ID*, not a secret.
npm run db:migrate
npx wrangler secret put BOT_TOKEN --config worker/wrangler.jsonc
# Enter @BotFather token directly at the secret prompt; never commit it.
npm run deploy:api
```

Edit the **public** API URL in `apps/web/config.js` to the deployed Worker URL and commit the change. `ALLOWED_ORIGIN` in `worker/wrangler.jsonc` must exactly match the hosting origin, e.g. `https://tgelemental.github.io` (no path). Worker automatically rejects other browser origins. Set up a Cloudflare account on the free plan; no billing upgrade is necessary for small-scale trials.

**Order:** first Cloudflare DB migration, then Worker deployment, then the Pages config URL; test `/health` and Telegram session from the actual bot. Two **manual-only** GitHub Actions (`deploy-worker.yml`, `deploy-telegram.yml`) are included; configure Cloudflare/Tgcloud repository secrets and a production environment before triggering them. They deliberately do not run on every merge.

## Telegram Serverless

From @BotFather, use the existing bot **only after verifying ownership**. Enable Serverless, link it with:

```bash
npx tgcloud login
npx tgcloud status
npx tgcloud push
```

Configure its **Main Mini App** and menu button to `https://tgelemental.github.io/Elemental/`. Assign the `@elementalgamebot` username if retained (or change `apps/web/config.js` and the bot link). Serverless functionality is a newly evolving platform; the CLI and enabled features must be verified on the actual bot before a public release. No local gateway credentials are committed.

The starter keeps game state entirely in Cloudflare. Serverless handles inbound `/start`, `/game`, `/help` and points users to the Mini App. Keeping the state at one source avoids split-brain balances between Telegram's beta database and D1.

## Archive legacy repos — after the new repo is pushed and verified

Use `scripts/archive-legacy.sh` (requires authenticated `gh` with admin permissions). Its default mode is **dry run**; it lists targets and verifies their existence, and requires the explicit `--apply` switch for changes. Recommended archive: `new`, `game`, `help`, `minione`; keep `.github` available to maintain the organization profile and link the successor. Consider separately archiving `jaavid/elementalgame` after its last snapshot / backup.

## Non-goals of v0.1

There is no real-money prize, TON token, Stars payment, bot broadcast, automated Cloudflare deploy, live weekly payouts, or anti-Sybil device fingerprinting implemented. Those need separate product decisions and abuse prevention. Avoid claiming otherwise.

See `docs/` for identity, system design, roadmap and launch gates.
