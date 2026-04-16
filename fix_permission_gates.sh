#!/bin/bash
# fix_permission_gates.sh
# Removes misplaced PermissionGate wraps and re-adds them
# at the correct location (inside the default export function).
#
# Run from repo root:
#   chmod +x fix_permission_gates.sh && ./fix_permission_gates.sh

set -e

declare -A SCREENS=(
  ["app/blocking-notes.tsx"]="blocking"
  ["app/call-sheets.tsx"]="call_sheets"
  ["app/cast-manager.tsx"]="cast"
  ["app/color-references.tsx"]="color_refs"
  ["app/comms-hub.tsx"]="messages"
  ["app/continuity.tsx"]="continuity"
  ["app/crew-directory.tsx"]="crew"
  ["app/festival-tracker.tsx"]="festivals"
  ["app/locations.tsx"]="locations"
  ["app/lookbook.tsx"]="lookbook"
  ["app/mood-boards.tsx"]="mood_board"
  ["app/production-notes.tsx"]="notes"
  ["app/script-breakdown.tsx"]="script_breakdown"
  ["app/script-sides.tsx"]="script_sides"
  ["app/selects.tsx"]="selects"
  ["app/shot-checklist.tsx"]="shot_checklist"
  ["app/shot-references.tsx"]="shot_refs"
  ["app/time-tracker.tsx"]="time_entries"
  ["app/vfx-tracker.tsx"]="vfx"
  ["app/wrap-reports.tsx"]="wrap_reports"
)

FIXED=0
FAILED=0

for FILE in "${!SCREENS[@]}"; do
  RESOURCE="${SCREENS[$FILE]}"

  if [ ! -f "$FILE" ]; then
    echo "⚠️  NOT FOUND: $FILE"
    ((FAILED++))
    continue
  fi

  # Step 1: Remove ALL existing PermissionGate lines (open + close tags)
  sed -i '' '/[[:space:]]*<PermissionGate resource="'"$RESOURCE"'">/d' "$FILE"
  sed -i '' '/[[:space:]]*<\/PermissionGate>/d' "$FILE"

  # Step 2: Find the line number of the LAST "return (" — which is
  # always the main screen's return (inner components come first)
  LAST_RETURN=$(grep -n "^  return (" "$FILE" | tail -1 | cut -d: -f1)

  if [ -z "$LAST_RETURN" ]; then
    # Try with different indentation
    LAST_RETURN=$(grep -n "return (" "$FILE" | tail -1 | cut -d: -f1)
  fi

  if [ -z "$LAST_RETURN" ]; then
    echo "❌ FAILED (no return found): $FILE"
    ((FAILED++))
    continue
  fi

  # Step 3: Insert <PermissionGate> on the line AFTER "return ("
  sed -i '' "${LAST_RETURN}s/return (/return (\n    <PermissionGate resource=\"${RESOURCE}\">/" "$FILE"

  # Step 4: Find the last ); in the file (closes the main return)
  LAST_CLOSE=$(grep -n "^  );" "$FILE" | tail -1 | cut -d: -f1)

  if [ -z "$LAST_CLOSE" ]; then
    echo "❌ FAILED (no closing ); found): $FILE"
    ((FAILED++))
    continue
  fi

  # Step 5: Insert </PermissionGate> before the closing );
  sed -i '' "${LAST_CLOSE}s/^  );/  <\/PermissionGate>\n  );/" "$FILE"

  echo "✅ FIXED [$RESOURCE]: $FILE"
  ((FIXED++))
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Fixed : $FIXED"
echo "Failed: $FAILED"
echo ""
echo "Verify with:"
echo "  for f in ${!SCREENS[@]}; do"
echo "    WRAP=\$(grep -n 'PermissionGate resource' \$f | head -1 | cut -d: -f1)"
echo "    EXPORT=\$(grep -n 'export default function' \$f | cut -d: -f1)"
echo "    [ \"\$WRAP\" -gt \"\$EXPORT\" ] && echo \"✅ OK: \$f\" || echo \"❌ WRONG: \$f\""
echo "  done"
