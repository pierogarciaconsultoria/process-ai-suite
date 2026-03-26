

## Plano: Corrigir chat de ajuda (ai-helpcenter)

### Causa raiz

A edge function `ai-helpcenter` não está registrada no `supabase/config.toml`, por isso nunca foi deployada. A chamada do widget falha e exibe o fallback de erro.

### Correções

**1. Registrar no config.toml**

Adicionar o bloco abaixo ao `supabase/config.toml`:

```toml
[functions.ai-helpcenter]
verify_jwt = false
```

**2. Deploy**

Após o registro, a function será deployada automaticamente. O `LOVABLE_API_KEY` já está configurado, então a IA responderá normalmente.

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/config.toml` | Adicionar registro da function `ai-helpcenter` |

Nenhuma alteração de código na function ou no widget e necessária.

