alter table public.generated_documents
  add column if not exists code text,
  add column if not exists revision text not null default 'Rev.00',
  add column if not exists revision_number integer not null default 0,
  add column if not exists source_mode text not null default 'independent',
  add column if not exists process_name text,
  add column if not exists area text,
  add column if not exists document_owner text,
  add column if not exists procedure_category text,
  add column if not exists approver_name text,
  add column if not exists approver_role text,
  add column if not exists distribution_list text[] not null default '{}',
  add column if not exists approval_history jsonb not null default '[]'::jsonb,
  add column if not exists review_history jsonb not null default '[]'::jsonb,
  add column if not exists distribution_history jsonb not null default '[]'::jsonb,
  add column if not exists linked_map_revision text,
  add column if not exists linked_map_approved_at timestamptz,
  add column if not exists map_version_label text;

create or replace function public.assign_generated_document_code()
returns trigger
language plpgsql
as $$
declare
  next_number integer;
begin
  if new.code is not null and btrim(new.code) <> '' then
    return new;
  end if;

  select coalesce(max((regexp_match(code, '^IT-(\d+)$'))[1]::integer), 0) + 1
    into next_number
  from public.generated_documents
  where company_id = new.company_id
    and code ~ '^IT-(\d+)$';

  new.code := 'IT-' || lpad(next_number::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists trg_assign_generated_document_code on public.generated_documents;

create trigger trg_assign_generated_document_code
before insert on public.generated_documents
for each row
execute function public.assign_generated_document_code();

with ranked_documents as (
  select
    id,
    company_id,
    row_number() over (
      partition by company_id
      order by created_at asc, id asc
    ) as document_sequence
  from public.generated_documents
)
update public.generated_documents as gd
set
  code = coalesce(gd.code, 'IT-' || lpad(ranked_documents.document_sequence::text, 3, '0')),
  revision = coalesce(
    nullif(gd.revision, ''),
    nullif(gd.generation_metadata ->> 'revision', ''),
    case
      when gd.version ~ '^Rev\.\d+$' then gd.version
      else 'Rev.00'
    end
  ),
  revision_number = coalesce(
    gd.revision_number,
    case
      when coalesce(gd.revision, gd.generation_metadata ->> 'revision', gd.version) ~ '^Rev\.\d+$'
        then substring(coalesce(gd.revision, gd.generation_metadata ->> 'revision', gd.version) from 'Rev\.(\d+)')::integer
      else 0
    end
  ),
  source_mode = coalesce(
    nullif(gd.source_mode, ''),
    case when gd.document_origin = 'mapped_process' then 'linked_process' else 'independent' end
  ),
  process_name = coalesce(nullif(gd.process_name, ''), nullif(gd.generation_metadata ->> 'processName', ''), ''),
  area = coalesce(nullif(gd.area, ''), nullif(gd.generation_metadata ->> 'area', ''), ''),
  document_owner = coalesce(nullif(gd.document_owner, ''), nullif(gd.generation_metadata ->> 'documentOwner', ''), ''),
  procedure_category = coalesce(nullif(gd.procedure_category, ''), nullif(gd.generation_metadata ->> 'procedureCategory', ''), ''),
  approver_name = coalesce(gd.approver_name, ''),
  approver_role = coalesce(gd.approver_role, ''),
  distribution_list = coalesce(gd.distribution_list, '{}'),
  approval_history = coalesce(gd.approval_history, '[]'::jsonb),
  review_history = coalesce(gd.review_history, '[]'::jsonb),
  distribution_history = coalesce(gd.distribution_history, '[]'::jsonb),
  linked_map_revision = coalesce(nullif(gd.linked_map_revision, ''), nullif(gd.generation_metadata ->> 'linkedMapRevision', ''), nullif(gd.generation_metadata ->> 'processRevision', '')),
  linked_map_approved_at = coalesce(
    gd.linked_map_approved_at,
    case
      when nullif(gd.generation_metadata ->> 'linkedMapApprovedAt', '') is not null
        then (gd.generation_metadata ->> 'linkedMapApprovedAt')::timestamptz
      else null
    end
  ),
  map_version_label = coalesce(nullif(gd.map_version_label, ''), nullif(gd.generation_metadata ->> 'mapVersionLabel', ''))
from ranked_documents
where gd.id = ranked_documents.id;

create unique index if not exists idx_generated_documents_company_code_revision
  on public.generated_documents(company_id, code, revision);

create index if not exists idx_generated_documents_status
  on public.generated_documents(status);

create index if not exists idx_generated_documents_process_id
  on public.generated_documents(process_id);

create index if not exists idx_generated_documents_source_mode
  on public.generated_documents(source_mode);
