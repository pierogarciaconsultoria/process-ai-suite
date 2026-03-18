

## Plano: Corrigir erro 400 na Edge Function `ai-fill-process`

### Problema

O modelo Gemini rejeita `enum` em campos com `type: "number"` dentro de schemas de tool calling. O erro diz "property is not defined" para os campos `required` em `criticidadeDetalhada` e `riscos.items`, porque o Gemini invalida propriedades que usam `enum` numérico.

### Solução

Remover `enum` dos campos numéricos no schema da tool call e confiar no system prompt (que já instrui os valores corretos). Campos afetados:

**`supabase/functions/ai-fill-process/index.ts`**:
- Linha 123: `probabilidade: { type: "number", enum: [1, 2, 3, 4, 5] }` → `probabilidade: { type: "number", description: "Valor de 1 a 5" }`
- Linha 124: `impacto: { type: "number", enum: [1, 2, 3, 4, 5] }` → `impacto: { type: "number", description: "Valor de 1 a 5" }`
- Linha 147: `impactoNegocio: { type: "number", enum: [1, 3, 5] }` → `impactoNegocio: { type: "number", description: "Valor: 1, 3 ou 5" }`
- Linha 148: `impactoCliente: { type: "number", enum: [1, 3, 5] }` → `impactoCliente: { type: "number", description: "Valor: 1, 3 ou 5" }`
- Linha 149: `riscoOperacional: { type: "number", enum: [1, 3, 5] }` → `riscoOperacional: { type: "number", description: "Valor: 1, 3 ou 5" }`

Nenhum outro arquivo precisa ser alterado.

