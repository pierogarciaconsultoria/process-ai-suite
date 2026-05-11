-- Multi-tenant / RLS validation script for Supabase SQL Editor
-- Replace the UUID placeholders before running.
--
-- Required placeholders:
--   CONSULTOR_USER_ID
--   EMPRESA_USER_ID
--   EMPRESA_A_ID
--   EMPRESA_B_ID
--
-- Recommended execution:
-- 1. Run one section at a time in the SQL Editor.
-- 2. Keep each mutating test inside BEGIN / ROLLBACK.
-- 3. Expected results are described above each query block.

-- ============================================================================
-- 0. Sanity checks
-- ============================================================================

select
  exists (
    select 1
    from pg_proc
    where proname = 'user_empresa_ids'
      and pronamespace = 'public'::regnamespace
  ) as has_user_empresa_ids;

select
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'ai_configurations'
  ) as has_ai_configurations;

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'ai_configurations'
  and column_name in ('id', 'company_id', 'config_type', 'content', 'updated_at', 'updated_by')
order by column_name;

-- ============================================================================
-- 1. Empresa user: helper and cross-company read must be blocked
-- Expected:
-- - user_empresa_ids() returns only EMPRESA_A_ID
-- - direct read of EMPRESA_B_ID data returns zero rows
-- ============================================================================

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'EMPRESA_USER_ID';
set local request.jwt.claim.role = 'authenticated';

select public.user_empresa_ids();

select id, company_id, config_type
from public.ai_configurations
where company_id = 'EMPRESA_B_ID';

select id, company_id, title, status
from public.generated_documents
where company_id = 'EMPRESA_B_ID';

rollback;

-- ============================================================================
-- 2. Consultor: helper must include owned/accessible companies
-- Expected:
-- - user_empresa_ids() includes EMPRESA_A_ID and EMPRESA_B_ID
-- - reads from both companies return rows when data exists
-- ============================================================================

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'CONSULTOR_USER_ID';
set local request.jwt.claim.role = 'authenticated';

select public.user_empresa_ids();

select id, company_id, config_type
from public.ai_configurations
where company_id in ('EMPRESA_A_ID', 'EMPRESA_B_ID')
order by company_id, config_type;

select id, company_id, title, status
from public.generated_documents
where company_id in ('EMPRESA_A_ID', 'EMPRESA_B_ID')
order by company_id, created_at desc;

rollback;

-- ============================================================================
-- 3. Invalid company_id insert must be blocked by RLS
-- Expected:
-- - INSERT raises "new row violates row-level security policy"
-- ============================================================================

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'EMPRESA_USER_ID';
set local request.jwt.claim.role = 'authenticated';

insert into public.ai_configurations (
  company_id,
  config_type,
  content,
  updated_by
) values (
  'EMPRESA_B_ID',
  'route_script',
  'Tentativa indevida entre empresas',
  'EMPRESA_USER_ID'
);

rollback;

-- ============================================================================
-- 4. Valid insert in own company must work
-- Expected:
-- - INSERT succeeds for EMPRESA_A_ID
-- ============================================================================

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'EMPRESA_USER_ID';
set local request.jwt.claim.role = 'authenticated';

insert into public.ai_configurations (
  company_id,
  config_type,
  content,
  updated_by
) values (
  'EMPRESA_A_ID',
  'skin_validation',
  'Teste de RLS por empresa',
  'EMPRESA_USER_ID'
);

rollback;

-- ============================================================================
-- 5. Interview session insert with invalid company must be blocked
-- Expected:
-- - INSERT fails if empresa_id is outside user_empresa_ids()
-- ============================================================================

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'EMPRESA_USER_ID';
set local request.jwt.claim.role = 'authenticated';

insert into public.interview_sessions (
  empresa_id,
  user_id,
  reason,
  messages,
  form_snapshot,
  progress,
  applied
) values (
  'EMPRESA_B_ID',
  'EMPRESA_USER_ID',
  'manual',
  '[]'::jsonb,
  '{}'::jsonb,
  0,
  false
);

rollback;

-- ============================================================================
-- 6. Generated documents delete permission check
-- Expected:
-- - delete only works for companies accessible to the current user
-- - use a disposable row or replace TARGET_DOCUMENT_ID safely
-- ============================================================================

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'CONSULTOR_USER_ID';
set local request.jwt.claim.role = 'authenticated';

-- Replace TARGET_DOCUMENT_ID with a disposable document from EMPRESA_A_ID.
-- delete from public.generated_documents
-- where id = 'TARGET_DOCUMENT_ID';

rollback;
