# Deploy Supabase (Migrations + Edge Functions)

- Pré-requisitos
  - Supabase CLI instalado e autenticado.
  - Ref do projeto (SUPABASE_PROJECT_REF).
  - Valores para SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.

- Link do projeto
  - `supabase link --project-ref <REF>`

- Segredos das Edge Functions
  - `supabase secrets set SUPABASE_URL="<URL>" SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE>" --project-ref <REF>`
  - Opcional: `supabase secrets set LOVABLE_API_KEY="<CHAVE>" --project-ref <REF>`

- Aplicar migrações
  - `supabase db push --project-ref <REF>`

- Deploy das funções
  - `supabase functions deploy org-onboarding --project-ref <REF>`
  - `supabase functions deploy org-list --project-ref <REF>`
  - `supabase functions deploy org-members --project-ref <REF>`
  - `supabase functions deploy org-invite --project-ref <REF>`

- Script único
  - Exportar variáveis e executar:
    - `export SUPABASE_PROJECT_REF=<REF>`
    - `export SUPABASE_URL=<URL>`
    - `export SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE>`
    - `export LOVABLE_API_KEY=<OPCIONAL>`
    - `bash scripts/deploy-supabase.sh`
