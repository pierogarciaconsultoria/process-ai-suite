

## Plano: Criar Edge Function `ai-interview`

### O que será feito

Criar e deployar a edge function `ai-interview` que conduz uma entrevista guiada por IA, fazendo uma pergunta por vez e estruturando as respostas no formato `ProcessoFormData`.

### Como funciona

O cliente envia o histórico de mensagens (`history`) e o estado atual do formulário (`current`). A IA analisa, faz a próxima pergunta e retorna campos preenchidos parcialmente.

```text
Cliente → { history: [...], current: {...} }
   ↓
ai-interview → Gemini 2.5 Flash (system prompt de entrevistador)
   ↓
Resposta → { nextQuestion: "...", partialUpdate: {...}, done: boolean }
```

### Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/ai-interview/index.ts` | Criar — edge function completa |
| `supabase/config.toml` | Adicionar bloco `[functions.ai-interview]` com `verify_jwt = false` |

### Detalhes técnicos

- **Edge function** (`ai-interview/index.ts`): Já existe o código no contexto do projeto — será criado com CORS, system prompt de entrevistador especializado em SIPOC/BPM, chamada ao Lovable AI Gateway com `google/gemini-2.5-flash`, parsing do JSON de resposta com fallback seguro
- **Config**: Registrar `verify_jwt = false` no `config.toml`
- **Deploy + teste**: Deployar e invocar com payload de teste para validar funcionamento
- Usa `LOVABLE_API_KEY` já configurado como secret

