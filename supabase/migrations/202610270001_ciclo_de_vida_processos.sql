-- Ciclo de vida do processo: Em entrevista → Diagnosticado → Melhorias aprovadas → Implementado (→ Obsoleto).
-- A documentação de um processo só é gerada depois de "Implementado".

alter table public.processos
  add column if not exists implementado_em timestamptz;

comment on column public.processos.implementado_em is
  'Quando as melhorias do plano foram marcadas como implantadas; libera a geração de documentação.';

-- A conversão não deve alterar a data de última atualização dos processos.
alter table public.processos disable trigger processos_set_updated_at;

update public.processos
set status = case
  when status = 'Rascunho' then 'Em entrevista'
  -- Entrevista guiada concluída (etapaAtual passa de 6): o plano de melhoria já foi aprovado.
  -- CASE aninhado: garante que o cast só roda quando etapaAtual é número.
  when status = 'Em revisão' and case
    when jsonb_typeof(entrevista_roteiro -> 'etapaAtual') = 'number' then (entrevista_roteiro ->> 'etapaAtual')::numeric > 6
    else false
  end then 'Melhorias aprovadas'
  when status = 'Em revisão' then 'Diagnosticado'
  when status in ('Aprovado', 'Publicado') then 'Implementado'
  else status
end
where status in ('Rascunho', 'Em revisão', 'Aprovado', 'Publicado');

update public.processos
set implementado_em = coalesce(mapa_aprovado_em, published_at, updated_at)
where status = 'Implementado' and implementado_em is null;

alter table public.processos enable trigger processos_set_updated_at;

alter table public.processos alter column status set default 'Em entrevista';

alter table public.processos drop constraint if exists processos_status_check;
alter table public.processos
  add constraint processos_status_check
  check (status in ('Em entrevista', 'Diagnosticado', 'Melhorias aprovadas', 'Implementado', 'Obsoleto'));
