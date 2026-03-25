#!/usr/bin/env bash
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-}"
if [ -z "$REF" ]; then
  echo "Defina SUPABASE_PROJECT_REF com o ref do projeto (ex.: abcd1234)"
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Instale o Supabase CLI: https://supabase.com/docs/guides/cli"
  exit 1
fi

if [ -n "${LOVABLE_API_KEY:-}" ] && [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  supabase secrets set LOVABLE_API_KEY="$LOVABLE_API_KEY" SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" --project-ref "$REF"
fi

supabase db push --project-ref "$REF"

supabase functions deploy org-onboarding --project-ref "$REF"
supabase functions deploy org-list --project-ref "$REF"
supabase functions deploy org-members --project-ref "$REF"
supabase functions deploy org-invite --project-ref "$REF"

echo "Deploy concluído"
