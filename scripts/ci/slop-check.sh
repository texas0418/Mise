#!/usr/bin/env bash
# Deterministic check for phrases that signal placeholder/demo code an LLM
# left behind. Case-insensitive; scans tracked source files only.
set -euo pipefail

PATTERNS=(
  'in a real app'
  'in a production app'
  'for demonstration purposes'
  'this is a simplified'
  'simplified version of'
  'you would typically'
  'left as an exercise'
  'as an AI'
  'YOUR_API_KEY'
  'lorem ipsum'
  # Mise has no machine-intelligence features and is not getting any. Copy
  # claiming otherwise has now shipped twice — "CSV & AI import" on the
  # onboarding screen (#96) and "AI tools" on the row that opens the paywall
  # (#101), the second one inducing a purchase for something that does not
  # exist. Both survived a manual sweep because the earlier grep was for the
  # capitalised form and the string was lowercase. These are matched
  # case-insensitively, like every pattern here.
  'ai tools'
  'ai import'
  'ai-powered'
  'ai powered'
  'powered by ai'
  'ai assistant'
)

FILES=$(git ls-files '*.ts' '*.tsx' '*.js' '*.jsx' | grep -v -e '^scripts/ci/' || true)
[ -z "$FILES" ] && exit 0

STATUS=0
for p in "${PATTERNS[@]}"; do
  if MATCHES=$(echo "$FILES" | xargs grep -lni "$p" 2>/dev/null); then
    echo "BANNED PHRASE \"$p\" found in:"
    echo "$MATCHES"
    STATUS=1
  fi
done

exit $STATUS
