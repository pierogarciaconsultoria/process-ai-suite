

## Comparison: PDF Document vs Current App Form

### PDF Document — "Mapeamento de Processo" (19 sections)

| # | Section | Description |
|---|---------|-------------|
| 1 | Identificação do Processo | Data, analista, empresa, processo, classificação (Negócio/Apoio/Gestão), área, dono, entrevistados, info adicionais |
| 2 | Contexto do Processo | Objetivo, por que existe |
| 3 | Gatilho do Processo | O que inicia o processo (chamado, solicitação, pedido, documento) |
| 4 | Entradas do Processo | Informações/documentos necessários |
| 5 | Descrição das Atividades | Tabela: Etapa, Atividade, Responsável, Ferramenta/Documento |
| 6 | Decisão do Processo | Aprovações, verificações, análises |
| 7 | Saída do Processo | Resultado final |
| 8 | Recursos | Sistemas, ferramentas, máquinas, documentos utilizados |
| 9 | Frequência do Processo | Frequência + tempo de execução |
| 10 | Dores e/ou Problemas | Retrabalho, atraso, erro, dependência, falta de padrão |
| 11 | Gargalos do Processo | Onde o processo trava |
| 12 | Riscos do Processo | Tabela: Risco, Consequência |
| 13 | Controles Existentes | Conferência, aprovação, checklist, validação |
| 14 | Indicadores Existentes | Tabela: Indicador, Meta |
| 15 | Sugestões de Melhoria | O que mudaria |
| 16 | Oportunidade de Automação | Atividades automatizáveis |
| 17 | Documentação Existente | POP, instrução de trabalho, manual, fluxograma |
| 17b | Criticidade do Processo | Impacto negócio/cliente/risco operacional (1-3-5) |
| 18 | Plano de Ação (5W2H) | Tabela: O que, Por quê, Quem, Quando, Como, Custo |
| 19 | Conclusão | Conclusão final |

### Current App Form (from `mock-processos.ts` + missing `ProcessoFormulario.tsx`)

The file `ProcessoFormulario.tsx` **does not exist** (build error). The mock data structure (`ProcessoFormMock`) covers only:

| Field in Mock | Maps to PDF Section |
|---|---|
| objetivo | 2. Contexto |
| clienteProcesso | 2. Contexto (cliente) |
| areasEnvolvidas | 2. Contexto (áreas) |
| entradas | 4. Entradas |
| etapas[] (ordem, atividade, responsavel, sistema) | 5. Descrição das Atividades |
| decisoes | 6. Decisão |
| saidas | 7. Saída |
| problemas (retrabalho, atrasos, erros, dependencia) | 10. Dores/Problemas |
| problemasTexto | 10. Dores/Problemas |
| riscos[] (risco, impacto) | 12. Riscos |
| indicadores | 14. Indicadores |
| sugestoes | 15. Sugestões |

### Sections MISSING from the app (not in mock or form)

| PDF # | Section | Status |
|---|---|---|
| 1 | Identificação (classificação Negócio/Apoio/Gestão, entrevistados, info adicionais) | **Partially missing** — has nome/area/responsavel but lacks classificação, entrevistados |
| 3 | Gatilho do Processo | **Missing** |
| 8 | Recursos (sistemas, ferramentas) | **Missing** |
| 9 | Frequência e Tempo de execução | **Missing** |
| 11 | Gargalos do Processo | **Missing** (separate from Dores) |
| 13 | Controles Existentes | **Missing** |
| 16 | Oportunidade de Automação | **Missing** |
| 17 | Documentação Existente | **Missing** |
| 17b | Criticidade detalhada (3 dimensões 1-3-5) | **Missing** (has simple criticidade) |
| 18 | Plano de Ação (5W2H) | **Missing** (has melhorias but not 5W2H) |
| 19 | Conclusão | **Missing** |

---

## Plan: Rebuild `ProcessoFormulario.tsx` aligned with the PDF

### Fix build errors
1. Create `ProcessoFormulario.tsx` — multi-step wizard with tabs matching the PDF's 19 sections
2. Create `ProcessoDetalhe.tsx` — read-only view of a mapped process

### Form structure (grouped into logical tabs/steps)

```text
Tab 1: Identificação
  - Seções 1 (Data, analista, empresa, processo, classificação, área, dono, entrevistados)

Tab 2: Contexto & Gatilho
  - Seções 2 (objetivo, por que existe, cliente, áreas) + 3 (gatilho)

Tab 3: Entradas
  - Seção 4

Tab 4: Atividades (Mapa)
  - Seção 5 — tabela dinâmica de etapas

Tab 5: Decisões & Saídas
  - Seções 6 + 7

Tab 6: Recursos & Frequência
  - Seções 8 + 9

Tab 7: Dores, Gargalos & Riscos
  - Seções 10 + 11 + 12

Tab 8: Controles & Indicadores
  - Seções 13 + 14

Tab 9: Melhorias & Automação
  - Seções 15 + 16 + 17 (documentação) + 17b (criticidade)

Tab 10: Plano de Ação & Conclusão
  - Seções 18 (5W2H) + 19
```

### Data model updates
- Update `ProcessoFormMock` type and mock data to include all missing fields: `classificacao`, `entrevistados`, `gatilho`, `recursos`, `frequencia`, `tempoExecucao`, `gargalos`, `controles`, `automacao`, `documentacao`, `criticidadeDetalhada`, `planoAcao[]`, `conclusao`
- Keep backward compatibility with existing mock entries

### Technical approach
- Use shadcn `Tabs` component for step navigation (matching existing pattern)
- Each tab as a self-contained section with proper form fields
- Dynamic table rows for etapas, riscos, plano de ação (5W2H)
- Radio groups for classificação, frequência, tempo
- Checkbox groups for problemas
- Rating selectors (1/3/5) for criticidade detalhada
- Navigation buttons (Anterior/Próximo/Salvar)

