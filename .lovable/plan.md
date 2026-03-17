

## Plano: Reorganizar Formulário em 4 Fases

### Nova estrutura (baseada na imagem)

```text
FASE 1 - Diagnóstico
├─ Identificação
├─ Contexto
├─ Dores & Gargalos
├─ Riscos
├─ Recursos
├─ Decisões
└─ Maturidade do processo (nova sub-aba)

FASE 2 - Mapeamento AS IS
├─ Fornecedor e Entradas
├─ Atividades
├─ Saídas e Cliente
├─ SIPOC (nova: visão consolidada)
└─ MAPA AS IS bpmn.io (nova: canvas BPMN)

FASE 3 - Mapeamento TO BE
├─ Melhorias
├─ Plano de Ação
├─ MAPA TO BE bpmn.io (nova: canvas BPMN)
└─ Indicadores

FASE 4 - Análise
└─ Relatório (gerar diagnóstico IA)
```

### Mudanças em `ProcessoFormulario.tsx`

- Substituir a `TabsList` horizontal de 12 abas por um **layout de 4 fases com sidebar lateral**
- Cada fase é um `Collapsible`/`Accordion` na sidebar esquerda com suas sub-abas listadas como itens clicáveis
- O conteúdo do formulário continua à direita, controlado pelo mesmo `Tabs` internamente
- Navegação "Anterior/Próximo" segue a ordem sequencial de todas as sub-abas across fases
- Fase ativa fica expandida automaticamente na sidebar

### Novas sub-abas a criar

1. **Maturidade do processo** (Fase 1): campos de criticidade detalhada (impacto negócio/cliente/risco operacional) — mover da aba "Melhorias" atual
2. **SIPOC** (Fase 2): visão consolidada read-only (tabela Fornecedor → Entrada → Processo → Saída → Cliente) montada automaticamente dos dados já preenchidos
3. **MAPA AS IS bpmn.io** (Fase 2): integrar o componente `BPMNCanvas` existente para gerar/visualizar o fluxograma AS-IS
4. **MAPA TO BE bpmn.io** (Fase 3): mesmo canvas BPMN para o fluxograma TO-BE
5. **Relatório** (Fase 4): botão "Gerar Diagnóstico" + visualização do resultado (mover a lógica do `handleDiagnose` atual e exibir inline ou navegar)

### Detalhes técnicos

- Definir constante `PHASES` com `{ id, label, icon, tabs: string[] }`
- Layout: `flex` com sidebar ~250px + conteúdo flex-1
- Sidebar usa `Accordion` (tipo "multiple") com items por fase, cada sub-aba é um botão com destaque quando ativo
- Mover criticidade detalhada de "melhorias" para nova sub-aba "maturidade"
- Renomear "Entradas" para "Fornecedor e Entradas", "Saídas" para "Saídas e Cliente"
- Componente `BPMNCanvas` já existe — reutilizar com props para AS-IS e TO-BE
- Sem novas dependências

### Arquivos modificados

- `src/pages/ProcessoFormulario.tsx` — reestruturação completa do layout e navegação
- `src/components/BPMNCanvas.tsx` — verificar/adaptar para aceitar contexto AS-IS vs TO-BE

