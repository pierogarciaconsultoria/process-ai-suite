-- Padrão de procedimento: novo tipo "exemplo_atividade" (uma atividade bem escrita, que mostra à
-- IA o nível de detalhe esperado na descrição). Pode rodar mais de uma vez.
begin;

alter table public.padroes_documento drop constraint if exists padroes_documento_tipo_check;
alter table public.padroes_documento
  add constraint padroes_documento_tipo_check
  check (tipo in ('estrutura_pr', 'estrutura_it', 'manual_escrita', 'exemplo_atividade'));

commit;

notify pgrst, 'reload schema';
