

# Process Intelligence - Plano de Implementação MVP

## Visão Geral
Sistema SaaS multiempresa para mapeamento, análise e melhoria de processos organizacionais com IA. Branding baseado na paleta Piero Garcia (Cerceta Escuro #003136, Verde Pinho #006B6B, Gelo #E4F1FD, Azul Celeste #BDDEF8).

## Design System
- Cores primárias: Cerceta Escuro (#003136) e Verde Pinho (#006B6B)
- Cores de fundo/apoio: Gelo (#E4F1FD) e Azul Celeste (#BDDEF8)
- Logo Piero Garcia no header/sidebar
- Layout com sidebar lateral colapsável, design limpo e moderno

## Backend (Lovable Cloud / Supabase)

### Autenticação
- Login por email/senha com recuperação de senha
- 3 perfis: super_admin, admin, user (tabela user_roles separada)
- Super admin: gerencia todas as empresas. Admin: gerencia sua empresa. User: mapeia processos.

### Banco de Dados (tabelas principais)
- **empresas**: id, nome, segmento, tamanho, data_cadastro
- **profiles**: id (FK auth.users), empresa_id, nome, email
- **user_roles**: id, user_id, role (super_admin/admin/user)
- **cadeia_valor**: id, empresa_id, nome, tipo (estratégico/operacional/apoio)
- **macroprocessos**: id, cadeia_valor_id, nome, responsavel, area
- **processos**: id, empresa_id, macroprocesso_id, nome, area, responsavel, status, objetivo, cliente_processo, areas_envolvidas, entradas, decisoes, saidas, criticidade
- **etapas_processo**: id, processo_id, ordem, atividade, responsavel, sistema
- **riscos**: id, processo_id, descricao, impacto
- **problemas**: id, processo_id, descricao, tipo (retrabalho/atrasos/erros/dependência)
- **indicadores**: id, processo_id, nome, formula, meta
- **melhorias**: id, processo_id, acao, responsavel, prazo, status
- **documentos_processo**: id, processo_id, tipo, conteudo (JSON com procedimento/diagnóstico/BPMN gerados pela IA)
- RLS por empresa_id em todas as tabelas

### Edge Functions (IA via Lovable AI Gateway)
1. **process-ai-engine**: Recebe dados do formulário master e gera: análise de gargalos, riscos, sugestões de melhoria, estrutura BPMN XML
2. **generate-bpmn**: Gera código BPMN XML a partir das etapas do processo
3. **generate-procedure**: Gera Procedimento Operacional Padrão completo
4. **suggest-indicators**: Sugere indicadores com fórmulas e metas
5. **process-redesign**: Gera versão TO-BE do processo com comparação AS-IS
6. **classify-processes**: Classifica processos na cadeia de valor automaticamente
7. **generate-report**: Compila todos os dados para geração de PDF

## Telas e Funcionalidades

### 1. Login / Recuperação de Senha
- Formulário de email/senha
- Link "Esqueci minha senha" com fluxo de reset
- Redirect pós-login baseado no perfil

### 2. Dashboard Principal
- Cards: total processos, processos críticos, riscos identificados, melhorias propostas
- Gráfico de processos por área (bar chart)
- Gráfico de nível de risco (pie chart)
- Filtro por empresa (para super_admin)

### 3. Gestão de Empresas (super_admin)
- CRUD de empresas com campos: nome, segmento, número de colaboradores
- Lista com busca e filtros

### 4. Gestão de Usuários
- CRUD de usuários vinculados à empresa
- Atribuição de perfil (admin/user)
- Super admin gerencia todos; admin gerencia usuários da sua empresa

### 5. Arquitetura de Processos
- **Cadeia de Valor**: Visualização em mapa com 3 faixas (Estratégico, Operacional, Apoio)
- **Macroprocessos**: Lista editável dentro de cada categoria da cadeia
- **Processos**: Lista vinculada ao macroprocesso com criticidade
- **Subprocessos e Atividades**: Vindos do formulário master
- Botão "Classificar com IA" para organizar automaticamente
- Geração do Process Landscape visual

### 6. Lista de Processos
- Tabela com: nome, área, responsável, status, data, criticidade
- Filtros por área, status, criticidade
- Botão "Novo Processo" → abre formulário master

### 7. Formulário Master de Processo
- Wizard multi-step com seções:
  - Identificação (nome, área, responsável)
  - Contexto (objetivo, cliente, áreas envolvidas)
  - Entradas (documentos/informações)
  - Etapas (tabela dinâmica: ordem, atividade, responsável, sistema)
  - Decisões (aprovações/validações)
  - Saídas (resultado final)
  - Problemas (checkboxes: retrabalho, atrasos, erros, dependência + campo livre)
  - Riscos (tabela: risco + impacto)
  - Indicadores existentes (texto)
  - Sugestões de melhoria (texto)
- Botão "Processar com IA" ao final

### 8. Visualização BPMN (bpmn.js)
- Renderização do fluxograma gerado pela IA usando bpmn.js
- Exibição interativa com zoom e pan
- Exportação: PNG, SVG, BPMN XML
- Abas: AS-IS e TO-BE (redesenho)

### 9. Diagnóstico do Processo
- Exibição dos resultados da IA: gargalos, riscos operacionais, pontos de atenção
- Cards visuais com severidade

### 10. Redesenho TO-BE
- Comparação lado a lado: processo atual vs. melhorado
- Lista de mudanças sugeridas pela IA (redução de etapas, automação, eliminação de retrabalho)
- BPMN do TO-BE

### 11. Documentação (Procedimento Operacional)
- Documento gerado pela IA com seções: identificação, objetivo, escopo, responsabilidades, descrição das atividades, fluxograma, documentos, riscos, controles
- Edição inline do conteúdo gerado
- Exportação PDF

### 12. Indicadores
- Tabela de indicadores sugeridos pela IA: nome, fórmula, meta
- Possibilidade de editar/adicionar manualmente

### 13. Plano de Melhoria
- CRUD de ações: ação, responsável, prazo, status (pendente/em andamento/concluído)
- Visualização tipo kanban ou tabela

### 14. Relatório Completo (PDF)
- Geração de PDF contendo: identificação, contexto, SIPOC, fluxograma BPMN, diagnóstico, riscos, melhorias, procedimento, indicadores, plano de ação
- Usando biblioteca de geração de PDF no frontend

### 15. Dashboard da Arquitetura
- Processos mapeados, críticos, sem documentação, sem indicadores
- Process Landscape automático

## Navegação (Sidebar)
- Dashboard
- Arquitetura de Processos
- Processos
- Empresas (super_admin)
- Usuários
- Relatórios
- Configurações

