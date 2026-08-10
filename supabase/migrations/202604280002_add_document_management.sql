create extension if not exists "vector";

create or replace function public.user_empresa_ids()
returns setof uuid
language sql
stable
as $$
  select e.id
  from public.empresas e
  where e.owner_id = auth.uid()
  union
  select m.empresa_id
  from public.membros m
  where m.user_id = auth.uid()
$$;

create or replace function public.user_can_manage_documentation(_empresa_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.empresas e
    where e.id = _empresa_id
      and e.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.membros m
    where m.empresa_id = _empresa_id
      and m.user_id = auth.uid()
      and m.perfil in ('admin', 'gestor')
  )
$$;

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.empresas(id) on delete cascade,
  name text not null,
  document_type text not null,
  description text,
  version text not null default '1.0',
  is_default boolean not null default false,
  is_active boolean not null default true,
  is_system_template boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_template_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.document_templates(id) on delete cascade,
  company_id uuid references public.empresas(id) on delete cascade,
  section_key text not null,
  section_title text not null,
  section_description text,
  sort_order integer not null default 0,
  is_required boolean not null default false,
  is_active boolean not null default true,
  source_type text not null default 'manual',
  generated_by_ai boolean not null default true,
  allows_attachments boolean not null default false,
  include_in_final_document boolean not null default true,
  include_in_ai_indexing boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_template_prompts (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.document_templates(id) on delete cascade,
  company_id uuid references public.empresas(id) on delete cascade,
  prompt_type text not null default 'generation',
  system_prompt text,
  generation_instructions text,
  tone text,
  detail_level text,
  target_audience text,
  include_risks boolean not null default true,
  include_indicators boolean not null default true,
  include_improvements boolean not null default true,
  include_action_plan boolean not null default true,
  include_checklist boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_template_variables (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.document_templates(id) on delete cascade,
  company_id uuid references public.empresas(id) on delete cascade,
  variable_key text not null,
  variable_label text not null,
  variable_description text,
  source_field text,
  data_type text,
  example_value text,
  is_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_generation_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.empresas(id) on delete cascade,
  default_template_id uuid references public.document_templates(id) on delete set null,
  require_approval boolean not null default true,
  approval_role text default 'gestor',
  versioning_enabled boolean not null default true,
  review_period_days integer not null default 180,
  auto_publish_after_approval boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.empresas(id) on delete cascade,
  process_id text,
  process_mapping_id text,
  template_id uuid not null references public.document_templates(id) on delete restrict,
  document_origin text not null,
  document_type text not null,
  title text not null,
  description_input text,
  content_text text,
  content_markdown text not null,
  status text not null default 'Rascunho',
  version text not null default '1.0',
  ai_model text,
  ai_prompt_used text,
  generation_metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.generated_documents(id) on delete cascade,
  company_id uuid not null references public.empresas(id) on delete cascade,
  version text not null,
  content_text text,
  content_markdown text not null,
  change_summary text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.generated_document_attachments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.generated_documents(id) on delete cascade,
  company_id uuid not null references public.empresas(id) on delete cascade,
  file_name text not null,
  file_type text,
  file_url text not null,
  file_size bigint,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.generated_documents(id) on delete cascade,
  company_id uuid not null references public.empresas(id) on delete cascade,
  process_id text,
  chunk_index integer not null,
  chunk_text text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_templates_company_id on public.document_templates(company_id);
create index if not exists idx_generated_documents_company_id on public.generated_documents(company_id);
create index if not exists idx_generated_documents_origin on public.generated_documents(document_origin);
create index if not exists idx_document_chunks_document_id on public.document_chunks(document_id);

alter table public.document_templates enable row level security;
alter table public.document_template_sections enable row level security;
alter table public.document_template_prompts enable row level security;
alter table public.document_template_variables enable row level security;
alter table public.document_generation_settings enable row level security;
alter table public.generated_documents enable row level security;
alter table public.generated_document_versions enable row level security;
alter table public.generated_document_attachments enable row level security;
alter table public.document_chunks enable row level security;

create policy document_templates_select_policy
  on public.document_templates
  for select
  using (
    (company_id is null and is_system_template = true)
    or company_id in (select public.user_empresa_ids())
  );

create policy document_templates_insert_policy
  on public.document_templates
  for insert
  with check (
    company_id in (select public.user_empresa_ids())
    and created_by = auth.uid()
    and public.user_can_manage_documentation(company_id)
    and is_system_template = false
  );

create policy document_templates_update_policy
  on public.document_templates
  for update
  using (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
    and is_system_template = false
  )
  with check (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
    and is_system_template = false
  );

create policy document_templates_delete_policy
  on public.document_templates
  for delete
  using (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
    and is_system_template = false
  );

create policy document_template_sections_manage_policy
  on public.document_template_sections
  for all
  using (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
  )
  with check (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
  );

create policy document_template_prompts_manage_policy
  on public.document_template_prompts
  for all
  using (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
  )
  with check (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
  );

create policy document_template_variables_manage_policy
  on public.document_template_variables
  for all
  using (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
  )
  with check (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
  );

create policy document_generation_settings_manage_policy
  on public.document_generation_settings
  for all
  using (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
  )
  with check (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
  );

create policy generated_documents_select_policy
  on public.generated_documents
  for select
  using (company_id in (select public.user_empresa_ids()));

create policy generated_documents_insert_policy
  on public.generated_documents
  for insert
  with check (
    company_id in (select public.user_empresa_ids())
    and created_by = auth.uid()
  );

create policy generated_documents_update_policy
  on public.generated_documents
  for update
  using (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
  )
  with check (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
  );

create policy generated_document_versions_manage_policy
  on public.generated_document_versions
  for all
  using (company_id in (select public.user_empresa_ids()))
  with check (company_id in (select public.user_empresa_ids()));

create policy generated_document_attachments_manage_policy
  on public.generated_document_attachments
  for all
  using (company_id in (select public.user_empresa_ids()))
  with check (company_id in (select public.user_empresa_ids()));

create policy document_chunks_manage_policy
  on public.document_chunks
  for all
  using (company_id in (select public.user_empresa_ids()))
  with check (company_id in (select public.user_empresa_ids()));
