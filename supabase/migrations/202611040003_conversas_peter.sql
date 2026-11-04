-- Conversas com o Peter na tela inicial. Cada usuário vê só as próprias conversas, dentro das
-- empresas de que participa. As respostas são gravadas pela função ai-peter-chat com o login do
-- próprio usuário. Pode rodar mais de uma vez.
begin;

create table if not exists public.peter_conversas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo text not null default 'Nova conversa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists peter_conversas_usuario_idx on public.peter_conversas (user_id, company_id, updated_at desc);

create table if not exists public.peter_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.peter_conversas(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  conteudo text not null,
  -- Atalhos para as telas citadas na resposta e o convite para mapear um processo.
  extras jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists peter_mensagens_conversa_idx on public.peter_mensagens (conversa_id, created_at);

-- Cada mensagem nova põe a conversa no topo da lista.
create or replace function public.peter_conversa_tocada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.peter_conversas set updated_at = now() where id = new.conversa_id;
  return new;
end;
$$;

drop trigger if exists peter_mensagens_toca_conversa on public.peter_mensagens;
create trigger peter_mensagens_toca_conversa
after insert on public.peter_mensagens
for each row execute function public.peter_conversa_tocada();

alter table public.peter_conversas enable row level security;
alter table public.peter_mensagens enable row level security;

drop policy if exists peter_conversas_do_usuario on public.peter_conversas;
create policy peter_conversas_do_usuario
  on public.peter_conversas for all to authenticated
  using (user_id = auth.uid() and company_id in (select public.user_empresa_ids()))
  with check (user_id = auth.uid() and company_id in (select public.user_empresa_ids()));

drop policy if exists peter_mensagens_do_usuario on public.peter_mensagens;
create policy peter_mensagens_do_usuario
  on public.peter_mensagens for all to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.peter_conversas c where c.id = conversa_id and c.user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.peter_conversas c where c.id = conversa_id and c.user_id = auth.uid()));

grant select, insert, update, delete on public.peter_conversas, public.peter_mensagens to authenticated;

commit;

notify pgrst, 'reload schema';
