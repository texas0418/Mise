#!/usr/bin/env bash
# Runs every logic suite in scripts/ and fails if any of them do.
#
# The suites are discovered, not listed. Seven of them accumulated over three
# sessions and none were wired into CI, so they only ran when somebody
# remembered — which is the same silent-omission failure test-cascade.ts exists
# to catch. A hardcoded list here would reproduce it: the eighth suite would be
# written, never added, and never run. Anything matching scripts/test-*.ts is
# picked up automatically.
#
# Runner per suite: node unless the file imports through the `@/` alias, which
# needs tsconfig paths and so needs bun. That is the actual reason bun is
# required, so it is the thing worth testing for — a new suite picks its own
# runner by how it is written.
set -euo pipefail

cd "$(dirname "$0")/../.."

shopt -s nullglob
SUITES=(scripts/test-*.ts)
shopt -u nullglob

# A glob that matches nothing would otherwise exit 0 and report "all passed",
# which is the most expensive way for this script to be wrong.
if [ ${#SUITES[@]} -eq 0 ]; then
  echo "No suites found matching scripts/test-*.ts — the runner is looking in the wrong place."
  exit 1
fi

STATUS=0
PASSED=0
FAILED=0

for suite in "${SUITES[@]}"; do
  if grep -q "from '@/" "$suite"; then
    RUNNER=(bun)
    LABEL=bun
  else
    RUNNER=(node --experimental-strip-types)
    LABEL=node
  fi

  if ! command -v "${RUNNER[0]}" >/dev/null 2>&1; then
    echo "FAIL $suite — ${RUNNER[0]} is not installed"
    STATUS=1
    FAILED=$((FAILED + 1))
    continue
  fi

  # Suites print their own "N passed, M failed" line and exit non-zero on any
  # failure. Keep their output on a failure; on a pass, keep only the tally.
  if OUTPUT=$("${RUNNER[@]}" "$suite" 2>&1); then
    printf '  %-28s %-5s %s\n' "$(basename "$suite")" "$LABEL" \
      "$(echo "$OUTPUT" | grep -E '[0-9]+ passed' | tail -1)"
    PASSED=$((PASSED + 1))
  else
    echo "FAIL $(basename "$suite") ($LABEL)"
    echo "$OUTPUT"
    STATUS=1
    FAILED=$((FAILED + 1))
  fi
done

echo
echo "$PASSED suite(s) passed, $FAILED failed"
exit $STATUS
