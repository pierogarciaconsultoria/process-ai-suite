#!/usr/bin/env bash
# Publica migrations, segredos e todas as edge functions num projeto Supabase.
#
# Uso:
#   export SUPABASE_PROJECT_REF=<ref>          # ex.: abcdefghijklmnopqrst
#   export SUPABASE_DB_PASSWORD=<senha do banco>
#   export OPENAI_API_KEY=<chave>               # opcional se já estiver nos segredos do projeto
#   bash scripts/deploy-supabase.sh --dry-run   # só mostra o que seria feito
#   bash scripts/deploy-supabase.sh             # aplica
#
# Requer Supabase CLI 2.x autenticado (supabase login). Depois deste script, publique o front.
set -euo pipefail

cd "$(dirname "$0")/.."

REF="${SUPABASE_PROJECT_REF:-}"
DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

if [ -z "$REF" ]; then
  echo "Defina SUPABASE_PROJECT_REF com o ref do projeto (ex.: abcd1234)." >&2
  exit 1
fi
if ! command -v supabase >/dev/null 2>&1; then
  echo "Instale o Supabase CLI 2.x: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

# Segredos lidos pelas edge functions. SUPABASE_URL, SUPABASE_ANON_KEY e
# SUPABASE_SERVICE_ROLE_KEY são fornecidos pela plataforma e não entram aqui.
OBRIGATORIOS=(OPENAI_API_KEY)
# LOVABLE_API_KEY ainda é usado por ai-fill-process e ai-diagnose-process (caminho Gemini).
RECOMENDADOS=(LOVABLE_API_KEY)
OPCIONAIS=(
  OPENAI_BASE_URL LOVABLE_BASE_URL
  RESEND_API_KEY RESEND_FROM_EMAIL INVITE_FROM_EMAIL
  SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM_EMAIL
  INVITE_APP_BASE_URL INVITE_EXPIRATION_HOURS
  AI_RATE_LIMIT_REQUESTS AI_RATE_LIMIT_WINDOW_SECONDS AI_CONCURRENCY_LIMIT
)

echo "==> Segredos já configurados no projeto"
SEGREDOS_REMOTOS="$(supabase secrets list --project-ref "$REF" 2>/dev/null || true)"

PARA_DEFINIR=()
for nome in "${OBRIGATORIOS[@]}" "${RECOMENDADOS[@]}" "${OPCIONAIS[@]}"; do
  if [ -n "${!nome:-}" ]; then PARA_DEFINIR+=("$nome=${!nome}"); fi
done

existe() { [ -n "${!1:-}" ] || grep -qw "$1" <<<"$SEGREDOS_REMOTOS"; }
for nome in "${OBRIGATORIOS[@]}"; do
  if ! existe "$nome"; then
    echo "Erro: $nome não está definido nem nos segredos do projeto. Exporte a variável e rode de novo." >&2
    exit 1
  fi
done
for nome in "${RECOMENDADOS[@]}"; do
  existe "$nome" || echo "Aviso: $nome não definido; 'Preencher com IA' e o diagnóstico do formulário antigo vão falhar."
done

FUNCOES=()
for dir in supabase/functions/*/; do
  nome="$(basename "$dir")"
  [ "$nome" = "_shared" ] || FUNCOES+=("$nome")
done

echo "==> Migrations pendentes"
supabase db push --project-ref "$REF" --dry-run

if $DRY_RUN; then
  echo "==> Segredos que seriam definidos: ${PARA_DEFINIR[*]%%=*}"
  echo "==> Functions que seriam publicadas (${#FUNCOES[@]}): ${FUNCOES[*]}"
  echo "Simulação concluída; nada foi alterado."
  exit 0
fi

echo "==> Aplicando migrations"
supabase db push --project-ref "$REF"

if [ "${#PARA_DEFINIR[@]}" -gt 0 ]; then
  echo "==> Definindo segredos: ${PARA_DEFINIR[*]%%=*}"
  supabase secrets set --project-ref "$REF" "${PARA_DEFINIR[@]}"
fi

echo "==> Publicando ${#FUNCOES[@]} functions"
for nome in "${FUNCOES[@]}"; do
  supabase functions deploy "$nome" --project-ref "$REF" --use-api
done

echo "Deploy do Supabase concluído. Agora publique o front (npm run build)."
