#!/usr/bin/env bash
# Esegue i test RLS via container Postgres locale di Supabase.
# Salva output in tests/sql/rls_test_results.md
set -uo pipefail

DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)"
if [ -z "$DB_CONTAINER" ]; then
  echo "Container Supabase DB non trovato. Lancia 'supabase start' prima." >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULT_FILE="$SCRIPT_DIR/rls_test_results.md"
SQL_FILE="$SCRIPT_DIR/rls_tests.sql"

echo "# RLS test results — $(date '+%Y-%m-%d %H:%M:%S')" >  "$RESULT_FILE"
echo "" >> "$RESULT_FILE"
echo '```' >> "$RESULT_FILE"

# psql -1 = single transaction, -v ON_ERROR_STOP=1 = abort on first error
OUT="$(docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres \
  -1 -v ON_ERROR_STOP=1 -f - < "$SQL_FILE" 2>&1)"
RC=$?

echo "$OUT" >> "$RESULT_FILE"
echo '```' >> "$RESULT_FILE"
echo "" >> "$RESULT_FILE"
if [ $RC -eq 0 ]; then
  PASSED=$(echo "$OUT" | grep -c "TEST .* OK")
  echo "## Esito: ✅ tutti i test passati ($PASSED notice OK)" >> "$RESULT_FILE"
  echo "$OUT"
  echo ""
  echo "✅ Tutti i test RLS passati. Report: $RESULT_FILE"
else
  echo "## Esito: ❌ FALLITO" >> "$RESULT_FILE"
  echo "$OUT" >&2
  echo "❌ Test RLS falliti. Vedi $RESULT_FILE" >&2
  exit 1
fi
