create table public.ai_usage_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  function_name text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  active_requests integer not null default 0 check (active_requests >= 0),
  consumed_units bigint not null default 0 check (consumed_units >= 0),
  estimated_cost_micros bigint not null default 0 check (estimated_cost_micros >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, company_id, function_name)
);

alter table public.ai_usage_limits enable row level security;

create policy ai_usage_limits_select_own
  on public.ai_usage_limits
  for select
  using (user_id = auth.uid() and company_id in (select public.user_empresa_ids()));

grant select on public.ai_usage_limits to authenticated;
grant all privileges on public.ai_usage_limits to service_role;

create or replace function public.acquire_ai_request(
  _company_id uuid,
  _function_name text,
  _request_limit integer default 20,
  _concurrency_limit integer default 2,
  _window_seconds integer default 60
)
returns table (allowed boolean, retry_after integer, denial_reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _row public.ai_usage_limits%rowtype;
  _now timestamptz := clock_timestamp();
begin
  if _user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if _company_id <> '00000000-0000-0000-0000-000000000000'::uuid
     and _company_id not in (select public.user_empresa_ids()) then
    raise exception 'company access denied' using errcode = '42501';
  end if;
  if coalesce(_function_name, '') = '' or _request_limit < 1 or _concurrency_limit < 1 or _window_seconds < 1 then
    raise exception 'invalid rate limit configuration' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(_user_id::text || ':' || _company_id::text || ':' || _function_name, 0));
  select * into _row from public.ai_usage_limits
    where user_id = _user_id and company_id = _company_id and function_name = _function_name
    for update;

  if not found then
    insert into public.ai_usage_limits(user_id, company_id, function_name, request_count, active_requests)
      values (_user_id, _company_id, _function_name, 1, 1);
    return query select true, 0, null::text;
    return;
  end if;

  if _row.window_started_at + make_interval(secs => _window_seconds) <= _now then
    update public.ai_usage_limits set window_started_at = _now, request_count = 1,
      active_requests = 1, updated_at = _now
      where user_id = _user_id and company_id = _company_id and function_name = _function_name;
    return query select true, 0, null::text;
    return;
  end if;

  if _row.active_requests >= _concurrency_limit then
    return query select false, 1, 'concurrency'::text;
    return;
  end if;
  if _row.request_count >= _request_limit then
    return query select false,
      greatest(1, ceil(extract(epoch from (_row.window_started_at + make_interval(secs => _window_seconds) - _now)))::integer),
      'quota'::text;
    return;
  end if;

  update public.ai_usage_limits set request_count = request_count + 1,
    active_requests = active_requests + 1, updated_at = _now
    where user_id = _user_id and company_id = _company_id and function_name = _function_name;
  return query select true, 0, null::text;
end;
$$;

create or replace function public.complete_ai_request(
  _company_id uuid,
  _function_name text,
  _consumed_units integer default 0,
  _estimated_cost_micros bigint default 0
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage_limits
  set active_requests = greatest(0, active_requests - 1),
      consumed_units = consumed_units + greatest(0, _consumed_units),
      estimated_cost_micros = estimated_cost_micros + greatest(0, _estimated_cost_micros),
      updated_at = clock_timestamp()
  where user_id = auth.uid() and company_id = _company_id and function_name = _function_name
$$;

revoke all on function public.acquire_ai_request(uuid, text, integer, integer, integer) from public;
revoke all on function public.complete_ai_request(uuid, text, integer, bigint) from public;
grant execute on function public.acquire_ai_request(uuid, text, integer, integer, integer) to authenticated;
grant execute on function public.complete_ai_request(uuid, text, integer, bigint) to authenticated;
