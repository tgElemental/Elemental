#!/usr/bin/env bash
set -euo pipefail
# This operation is intentionally manual: requires the owner's GH authentication.
# We DO NOT archive tgElemental/.github; it's the public organization landing profile.
repos=(new game help minione)
if ! command -v gh >/dev/null; then
  echo 'Install/authenticate GitHub CLI: gh auth login' >&2
  exit 1
fi
if [[ "${1:-}" == '--apply' ]]; then
  printf 'This will ARCHIVE: %s\n' "${repos[*]}"
  read -r -p "Have you verified tgElemental/Elemental is live? Type ARCHIVE: " answer
  [[ "$answer" == ARCHIVE ]] || { echo 'Aborted'; exit 1; }
  for repo in "${repos[@]}"; do
    gh api --method PATCH "repos/tgElemental/$repo" -F archived=true --silent
    echo "Archived: tgElemental/$repo"
  done
else
  echo 'Dry run (no changes). Target old project repos:'
  for repo in "${repos[@]}"; do
    gh repo view "tgElemental/$repo" --json name,isArchived,url --jq '{name,isArchived,url}'
  done
  echo 'To archive after successor launch: ./scripts/archive-legacy.sh --apply'
fi
