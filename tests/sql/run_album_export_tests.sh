#!/usr/bin/env bash
# Esegue i test di EXPORT ALBUM (30 album × 2 dimensioni) sul Postgres locale di Supabase.
# Output in tests/sql/album_export_results.md
set -uo pipefail

DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)"
if [ -z "$DB_CONTAINER" ]; then
  echo "Container Supabase DB non trovato. Lancia 'supabase start' prima." >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULT_FILE="$SCRIPT_DIR/album_export_results.md"
SQL_FILE="$SCRIPT_DIR/album_export_tests.sql"

echo "# Album export test results — $(date '+%Y-%m-%d %H:%M:%S')" >  "$RESULT_FILE"
echo "" >> "$RESULT_FILE"
echo '```' >> "$RESULT_FILE"

OUT="$(docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres \
  -1 -v ON_ERROR_STOP=1 -f - < "$SQL_FILE" 2>&1)"
RC=$?

echo "$OUT" | grep -iE "NOTICE|ERROR|FAIL" | sed 's/^.*NOTICE:  //' >> "$RESULT_FILE"
echo '```' >> "$RESULT_FILE"
echo "" >> "$RESULT_FILE"
if [ $RC -eq 0 ]; then
  PASSED=$(echo "$OUT" | grep -c "TEST .* OK")
  echo "## Esito: ✅ tutti i test passati ($PASSED gruppi OK, 60 export verificati)" >> "$RESULT_FILE"
  echo "$OUT" | grep -iE "NOTICE" | sed 's/^.*NOTICE:  //'
  echo ""
  echo "✅ Album export: tutti i test passati. Report: $RESULT_FILE"
else
  echo "## Esito: ❌ FALLITO" >> "$RESULT_FILE"
  echo "$OUT" >&2
  echo "❌ Album export test falliti. Vedi $RESULT_FILE" >&2
  exit 1
fi
