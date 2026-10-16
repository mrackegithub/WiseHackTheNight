#!/usr/bin/env bash
# Fails if the current branch touches files outside its agent's zone.
# Branch prefix decides the agent:  fe/* -> A,  be/* -> B,  int/* -> C,
# contract/* and chore/* -> human (no restrictions).
# Usage: scripts/check-ownership.sh [base-ref]   (default: origin/main, falls back to main)
set -euo pipefail

BASE="${1:-origin/main}"
git rev-parse --verify -q "$BASE" >/dev/null || BASE=main
BRANCH="${GITHUB_HEAD_REF:-$(git rev-parse --abbrev-ref HEAD)}"

case "$BRANCH" in
  fe/*)  AGENT=A ;;
  be/*)  AGENT=B ;;
  int/*) AGENT=C ;;
  contract/*|chore/*|main) echo "ownership: human branch '$BRANCH' – skipped"; exit 0 ;;
  *) echo "ownership: branch '$BRANCH' has no valid prefix (fe/ be/ int/ contract/ chore/)"; exit 1 ;;
esac

# Paths are regexes matched against repo-relative file paths.
allowed_A=(
  '^apps/web/'
  '^docs/stack/frontend\.md$'
  '^docs/handoffs/fe-to-(be|int|human)-[a-z0-9-]+\.md$'
)
allowed_B=(
  '^apps/api/'
  '^docs/stack/backend\.md$'
  '^docs/handoffs/be-to-(fe|int|human)-[a-z0-9-]+\.md$'
)
forbidden_B=(
  '^apps/api/src/modules/integrations/'
  '^apps/api/prisma/schema/(base|integrations)\.prisma$'
  '^apps/api/prisma/seed/integrations\.seed\.ts$'
  '^apps/api/prisma/migrations/[^/]+_int_'
  '^apps/api/prisma/migrations/migration_lock\.toml$'
)
allowed_C=(
  '^packages/integrations/'
  '^apps/api/src/modules/integrations/'
  '^apps/api/prisma/schema/integrations\.prisma$'
  '^apps/api/prisma/seed/integrations\.seed\.ts$'
  '^apps/api/prisma/migrations/[0-9]+_int_[a-z0-9_]+/'
  '^docs/stack/integrations\.md$'
  '^docs/handoffs/int-to-(fe|be|human)-[a-z0-9-]+\.md$'
)
forbidden_C=(
  '^packages/integrations/src/ports\.ts$'
)
forbidden_A=()

# Applies to every agent: Phase-0 frozen files.
forbidden_all=(
  '^contracts/'
  '^packages/contracts/'
  '^AGENTS\.md$'
  '^docs/ARCHITECTURE\.md$'
  '^docs/decisions/'
  '^\.github/'
  '^scripts/'
  '^(package\.json|pnpm-workspace\.yaml|\.npmrc|docker-compose\.yml)$'
)

eval "allowed=(\"\${allowed_${AGENT}[@]}\")"
eval "forbidden=(\"\${forbidden_${AGENT}[@]}\" \"\${forbidden_all[@]}\")"

violations=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  ok=0
  for p in "${allowed[@]}"; do [[ "$f" =~ $p ]] && ok=1 && break; done
  for p in "${forbidden[@]}"; do [[ "$f" =~ $p ]] && ok=0; done
  # B may only add migrations whose name contains _be_
  if [[ $AGENT == B && "$f" =~ ^apps/api/prisma/migrations/[0-9]+_ && ! "$f" =~ ^apps/api/prisma/migrations/[0-9]+_be_ ]]; then ok=0; fi
  if [[ $ok -eq 0 ]]; then echo "  ✗ $f"; violations=$((violations+1)); fi
done < <(git diff --name-only "$(git merge-base "$BASE" HEAD)"...HEAD)

if [[ $violations -gt 0 ]]; then
  echo "ownership: Agent $AGENT touched $violations file(s) outside its zone (see AGENTS.md §2)."
  echo "Revert them and file a handoff in docs/handoffs/ instead."
  exit 1
fi
echo "ownership: Agent $AGENT – OK"
