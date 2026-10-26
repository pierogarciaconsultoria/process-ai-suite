alter table public.processos
  add column if not exists entrevista_roteiro jsonb;

comment on column public.processos.entrevista_roteiro is
  'Estado da entrevista guiada do Peter: etapa atual, respostas por pergunta do roteiro, ajustes pedidos e análises (diagnóstico AS IS e plano de melhoria).';
