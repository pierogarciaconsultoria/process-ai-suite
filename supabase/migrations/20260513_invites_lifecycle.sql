alter table public.convites
  add column if not exists expires_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by uuid references auth.users(id) on delete set null,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id) on delete set null,
  add column if not exists revoked_reason text;

update public.convites
set expires_at = coalesce(expires_at, created_at + interval '7 days')
where expires_at is null;

update public.convites
set accepted_at = coalesce(accepted_at, created_at)
where status = 'accepted'
  and accepted_at is null;

update public.convites
set revoked_at = coalesce(revoked_at, created_at)
where status = 'revoked'
  and revoked_at is null;

alter table public.convites
  alter column expires_at set default (now() + interval '7 days'),
  alter column expires_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'convites_revoked_reason_check'
  ) then
    alter table public.convites
      add constraint convites_revoked_reason_check
      check (
        revoked_reason is null
        or revoked_reason in ('expired', 'cancelled', 'replaced', 'delivery_failed')
      );
  end if;
end $$;

create unique index if not exists convites_token_unique
  on public.convites (token)
  where token is not null;

create index if not exists convites_empresa_status_idx
  on public.convites (empresa_id, status);

create index if not exists convites_expires_at_idx
  on public.convites (expires_at);
