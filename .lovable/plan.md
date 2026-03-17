

## Plano: Motor de Diagnóstico e Análise por IA (6 Fases)

### O que muda

Hoje o sistema coleta dados em 12 abas e tem um "Preencher com IA" que popula o formulário. O prompt descreve uma **segunda camada**: após o preenchimento, a IA analisa todos os dados e gera um **relatório estruturado de 6 fases** com insights, scores e recomendações. Isso não existe no sistema atual.

### Resumo das mudanças

**1. Nova Edge Function `ai-diagnose-process`**
Recebe o `ProcessoFormData` completo e retorna um JSON estruturado com as 6 fases:
- Fase 1 (Mapeamento AS-IS): resumo executivo, descrição ponta a ponta, atores, fluxo lógico
- Fase 2 (Diagnóstico): lista de problemas, gargalos, retrabalho, análise de riscos, impactos
- Fase 3 (Maturidade): classificação de atividades (valor/suporte/desperdício), score 0-100, nível de maturidade (1-5), maturidade digital (baixa/média/alta)
- Fase 4 (TO-BE): melhorias com tipo de tecnologia (RPA/Workflow/API/IA/BI), impacto, complexidade, prioridade
- Fase 5 (5W2H): plano de ação completado e priorizado
- Fase 6 (KPIs): indicadores com fórmula, periodicidade, responsável, classificação (estratégico/tático/operacional, leading/lagging)
- Análise Final: top 5 problemas, top 5 oportunidades, recomendação estratégica

Usa tool calling com schema completo para structured output. Modelo: `google/gemini-2.5-flash`.

**2. Nova página `ProcessoDiagnostico.tsx`**
Página de visualização do relatório gerado, com cards/seções para cada fase. Acessível via botão "Gerar Diagnóstico" no formulário e via rota `/processos/:id/diagnostico`.

**3. Novos tipos em `processo-form-types.ts`**
Interfaces para o resultado do diagnóstico (`DiagnosticoResult` com sub-tipos por fase).

**4. Botão "Gerar Diagnóstico" no formulário**
Na última aba ou como ação global, botão que envia todos os dados do formulário para a edge function e navega para a página de diagnóstico.

**5. Rota nova no `App.tsx`**
`/processos/:id/diagnostico` apontando para `ProcessoDiagnostico`.

### Detalhes técnicos

- O prompt do usuário será usado como **system prompt** da edge function `ai-diagnose-process`, adaptado para tool calling
- O schema do tool call terá ~30 campos aninhados cobrindo todas as 6 fases
- O relatório será renderizado com markdown (react-markdown) para textos longos e tabelas/badges para dados estruturados
- Score de maturidade e maturidade digital serão exibidos com indicadores visuais (progress bar, badges coloridos)
- Como não há persistência ainda, o diagnóstico será gerado on-demand e mantido em state; persistência pode ser adicionada depois

### O que NÃO muda
- O formulário de 12 abas continua igual
- O "Preencher com IA" continua funcionando
- A edge function `ai-fill-process` não é alterada

