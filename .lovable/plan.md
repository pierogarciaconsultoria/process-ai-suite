## Diagnóstico

Reproduzi a chamada `POST /org-onboarding` e ela responde **200** com:

```json
{ "empresa": { "id": "temp-1779108782594", "note": "Fallback sem persistência..." } }
```

A última empresa real no banco é de 2026-04-03. Nada novo desde então — mesmo a função respondendo 200.

**Causa raiz:** a edge function `supabase/functions/org-onboarding/index.ts` envolve cada operação (`select existing`, `insert empresa`, `insert membros`, `select empresa`) em um bloco que, no menor erro, devolve um objeto falso com `id: "temp-..."` e mensagem "Fallback sem persistência". O frontend (`Empresas.tsx`) confia nesse retorno, faz `setEmpresas(prev => [e, ...prev])` e exibe a empresa só em memória. Ao recarregar, `org-list` não traz nada porque o insert nunca aconteceu.

Esse fallback foi pensado para "quando o schema ainda não existe", mas hoje o schema existe e o fallback está mascarando o erro real (provavelmente RLS, JWT ou cache de schema). O resultado é a empresa aparecer momentaneamente e depois sumir, exatamente como você descreveu.

## Plano

### 1. Remover todos os fallbacks silenciosos em `org-onboarding/index.ts`
- Eliminar os blocos `if (existingErr) { return {empresa: temp-...} }`, `if (createErr) {...}`, `if (empFetchErr) {...}` e o catch final com `id: temp-...`.
- Em qualquer erro real do Supabase, retornar `4xx/500` com `{ error, code, details, hint }` para o frontend ver e logar.
- Manter logs (`console.error`) com `user.id`, payload e erro completo para aparecerem em `edge function logs`.

### 2. Garantir contexto de auth correto
- Validar que o `Authorization: Bearer <jwt>` chega na função (rejeitar 401 se faltar, em vez de seguir).
- Confirmar `owner_id = user.id` no insert (já está, mas será reforçado após remover fallback).

### 3. Ajustar o frontend `src/pages/Empresas.tsx`
- Tratar erro do `supabase.functions.invoke`: mostrar `toast` com a mensagem real do servidor.
- Após sucesso, em vez de só dar `setEmpresas([e, ...prev])` com o retorno, re-buscar via `org-list` para garantir que veio do banco (ou ao menos checar se `e.id` não começa com `temp-` — defensivo durante a transição).

### 4. Redeploy + reteste
- Deploy de `org-onboarding`.
- Rodar `curl_edge_functions` com um nome novo e confirmar `id` UUID real.
- `SELECT` em `empresas` confirmando o registro.
- Se aparecer erro RLS/JWT no retorno, corrigir na sequência (provável causa: cache de schema da PostgREST ou política — será endereçado assim que o erro real for visível).

### 5. (Opcional, depois) Considerar insert direto pelo client
- Como existe RLS válida (`owner_id = auth.uid()`), o frontend pode futuramente fazer `supabase.from("empresas").insert(...)` direto, eliminando a edge function. Não está no escopo desta correção, mas reduz superfície de falha.

## Arquivos a alterar
- `supabase/functions/org-onboarding/index.ts` — remover fallbacks, propagar erros.
- `src/pages/Empresas.tsx` — exibir erro real no toast e revalidar lista após criar.

## Entregável
- Criar uma empresa pela UI persiste em `public.empresas` e permanece após reload.
- Qualquer falha futura aparece como erro claro (toast + log da edge function), sem "empresa fantasma".
