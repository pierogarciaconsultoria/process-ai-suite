## Plano: Módulo de Documentação do Processo

### Objetivo

Evoluir `Configurações > Documentação do Processo` para uma central configurável de modelos documentais, capaz de:

- parametrizar templates, seções, prompts, variáveis, anexos, aprovação e versionamento;
- gerar documentos a partir de `processo mapeado` ou `descrição livre`;
- salvar os documentos em estrutura preparada para futura evolução para `Gestão de Documentos` com capacidades de consulta inteligente.

### Escopo incremental implementado agora

#### 1. Planejamento e arquitetura

- Consolidar a arquitetura do módulo neste arquivo.
- Manter o card atual `Documentação do Processo` e reaproveitar a rota já existente.
- Centralizar defaults, tipos e comportamento inicial em um arquivo de configuração do frontend.

#### 2. Frontend

- Transformar a página `ConfigDocumentacaoProcesso` em uma tela completa com abas:
  - `Modelos`
  - `Estrutura`
  - `Prompts e IA`
  - `Variáveis`
  - `Anexos`
  - `Aprovação e Versionamento`
  - `Integração com Documentos Inteligentes`
- Adicionar ação `Novo Documento` com duas rotas de geração:
  - a partir de processo mapeado;
  - a partir de descrição livre.
- Permitir prévia, edição e salvamento incremental do documento gerado.

#### 3. Backend e banco

- Criar migration para tabelas documentais:
  - `document_templates`
  - `document_template_sections`
  - `document_template_prompts`
  - `document_template_variables`
  - `document_generation_settings`
  - `generated_documents`
  - `generated_document_versions`
  - `generated_document_attachments`
  - `document_chunks`
- Aplicar RLS multitenant:
  - leitura isolada por empresa;
  - templates globais do sistema apenas em leitura;
  - edição/publicação restrita a perfis com permissão.
- Registrar edge function segura para geração via IA sem expor chaves no frontend.

### Fluxos principais

#### A. Documento a partir de processo mapeado

1. Usuário abre `Novo Documento`.
2. Seleciona `A partir de processo mapeado`.
3. Escolhe processo e template.
4. Seleciona seções ou usa as ativas por padrão.
5. Sistema monta payload com dados estruturados do processo.
6. Edge function gera markdown com base no template.
7. Usuário revisa, ajusta e salva.

#### B. Documento a partir de descrição livre

1. Usuário abre `Novo Documento`.
2. Seleciona `A partir de descrição livre`.
3. Preenche formulário assistido.
4. Sistema envia payload de descrição + template para a edge function.
5. IA retorna markdown estruturado.
6. Usuário revisa, ajusta e salva.

### Arquivos-alvo

| Arquivo | Papel |
|---------|-------|
| `src/pages/ConfigDocumentacaoProcesso.tsx` | Tela principal com abas e modal de criação |
| `src/data/documentation-config.ts` | Tipos, defaults e helpers do módulo |
| `supabase/functions/ai-generate-document/index.ts` | Geração segura de documentos com IA |
| `supabase/config.toml` | Registro da nova edge function |
| `supabase/migrations/*_document_management.sql` | Estrutura e RLS do módulo |

### Decisões arquiteturais

- `company_id` e `created_by` são obrigatórios em documentos persistidos.
- `process_id` e `process_mapping_id` permanecem opcionais.
- Como o projeto ainda não possui uma tabela relacional oficial de processos, os campos de processo no módulo documental ficam preparados de forma compatível e opcional.
- O frontend usa persistência local como camada incremental de UX, sem impedir a futura troca por persistência 100% no banco.
- O documento final é salvo em `markdown`, com metadados suficientes para futura chunkização, embeddings e consulta inteligente.

### Próximos passos após esta entrega

- Conectar o CRUD da tela diretamente às novas tabelas do Supabase.
- Implementar importação real de anexos para storage.
- Conectar documentos gerados aos processos persistidos quando o módulo de processos tiver IDs relacionáveis no banco.
- Adicionar visualização de versões anteriores e fluxo real de aprovação/publicação.
- Evoluir para indexação/chunks/embeddings no módulo futuro de gestão documental.
