alter table public.empresas
  add column if not exists area_atuacao text,
  add column if not exists contexto text;

