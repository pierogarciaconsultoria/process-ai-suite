

## Preenchimento Automático por IA na Aba Contexto

### O que será feito

Adicionar um campo "Descrição do Processo" na aba Contexto com um botão "Preencher com IA". O analista descreve o processo em texto livre, clica no botão, e a IA preenche automaticamente todas as demais abas do formulário (Entradas, Atividades, Decisões, Saídas, Dores, Riscos, Controles, Indicadores, Melhorias, Plano de Ação).

### Arquitetura

1. **Edge function `ai-fill-process`** — Recebe a descrição do processo, chama o Lovable AI Gateway (Gemini) com um prompt estruturado que retorna JSON alinhado ao `ProcessoFormData`. Usa tool calling para structured output.

2. **Atualizar `src/pages/ProcessoFormulario.tsx`** — Adicionar na aba Contexto:
   - Campo `Textarea` "Descreva o processo detalhadamente"
   - Botão "Preencher com IA" (com loading state)
   - Ao receber resposta, popula o `form` state com os dados retornados

3. **Remover `src/lib/ai.ts`** — Substituir pela edge function (não expor API keys no client).

### Detalhes técnicos

**Edge function** receberá a descrição e retornará structured output via tool calling com schema alinhado aos tipos do formulário (`EntradaForm[]`, `EtapaForm[]`, `SaidaForm[]`, `RiscoForm[]`, `IndicadorForm[]`, `PlanoAcao5W2H[]`, problemas, decisões, etc.).

**Frontend** chamará `supabase.functions.invoke('ai-fill-process', { body: { descricao } })`, receberá o JSON e fará merge no state do formulário, preservando campos já preenchidos na aba Identificação/Contexto.

**Modelo**: `google/gemini-2.5-flash` (bom equilíbrio custo/qualidade para structured output).

