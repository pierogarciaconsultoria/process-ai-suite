

## Plano: Deploy da Edge Function `ai-interview`

### Estado atual

- `supabase/functions/ai-interview/index.ts` — existe e está completo
- `supabase/config.toml` — já registra `[functions.ai-interview]` com `verify_jwt = false`
- `LOVABLE_API_KEY` — já configurado nos secrets do projeto
- `AI_MODEL` — não está nos secrets, mas o código já tem fallback para `google/gemini-2.5-flash`

### O que será feito

1. **Deploy** da edge function `ai-interview`
2. **Teste** com payload de exemplo para confirmar funcionamento
3. **AI_MODEL** (opcional) — se desejar usar um modelo diferente do `gemini-2.5-flash`, posso configurar o secret `AI_MODEL`; caso contrário, o fallback padrão já funciona

### Nenhum arquivo precisa ser modificado

Tudo já está no lugar. Apenas deploy + verificação.

