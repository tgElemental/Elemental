#!/usr/bin/env bash
set -euo pipefail

# Import the extracted Elemental source into the existing GitHub repository
# through a reviewable branch and pull request. Does not touch main directly.
REPO='tgElemental/Elemental'
BRANCH='feat/bootstrap-elemental-v2'
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v git >/dev/null || { echo 'git is required' >&2; exit 1; }
command -v gh >/dev/null || { echo 'GitHub CLI is required (https://cli.github.com/)' >&2; exit 1; }
gh auth status >/dev/null || { echo 'Run: gh auth login' >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

gh repo clone "$REPO" "$WORK/repo"
git -C "$WORK/repo" checkout -b "$BRANCH"
# Do not transfer local Git history, environment variables, or caches.
tar -C "$ROOT" --exclude='./.git' --exclude='./.env' --exclude='*/__pycache__' --exclude='*.pyc' -cf - . | tar -C "$WORK/repo" -xf -
git -C "$WORK/repo" add -A
if git -C "$WORK/repo" diff --cached --quiet; then
  echo 'Nothing to import.'
  exit 0
fi
git -C "$WORK/repo" commit -m 'feat: bootstrap Elemental v2 mini app and serverless game'
git -C "$WORK/repo" push --set-upstream origin "$BRANCH"
gh pr create --repo "$REPO" --base main --head "$BRANCH" \
  --title 'feat: Elemental v2 foundation' \
  --body 'Initial no-VPS Elemental v2: Cloudflare Worker + D1, GitHub Pages Mini App, Telegram Serverless handler, game engine, unit tests, documentation and manual deployment workflows. No production keys or infrastructure provisioned yet.'
