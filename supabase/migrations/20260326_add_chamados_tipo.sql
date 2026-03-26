alter table public.chamados
  add column if not exists tipo text not null default 'duvida' check (tipo in ('duvida','incidente','requisicao','melhoria'));

