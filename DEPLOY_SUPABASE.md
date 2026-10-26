# Deploy Supabase (migrations, segredos e edge functions)

## Pré-requisitos

- Supabase CLI 2.x instalado e autenticado (`supabase login`).
- Ref do projeto (`SUPABASE_PROJECT_REF`) e senha do banco (`SUPABASE_DB_PASSWORD`).
- Chave da OpenAI (`OPENAI_API_KEY`), usada por todas as funções do Peter. Só precisa ser exportada na primeira vez; depois fica nos segredos do projeto.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos pela plataforma às edge functions e não precisam ser configurados.

## Ordem do deploy

1. Migrations
2. Edge functions
3. Front

O front deve ir para o ar logo depois das migrations: a constraint `processos_status_check` recusa os status antigos (`Rascunho`, `Em revisão`), que o front anterior ainda grava.

## Script único

```bash
export SUPABASE_PROJECT_REF=<ref>
export SUPABASE_DB_PASSWORD=<senha do banco>
export OPENAI_API_KEY=<chave>

bash scripts/deploy-supabase.sh --dry-run   # mostra migrations pendentes, segredos e functions; não altera nada
bash scripts/deploy-supabase.sh             # aplica
```

O script:

- para com erro se `OPENAI_API_KEY` não estiver exportada nem nos segredos do projeto;
- avisa se `LOVABLE_API_KEY` faltar (ainda usada por `ai-fill-process` e `ai-diagnose-process`);
- aplica as migrations pendentes (`supabase db push`);
- grava como segredo as variáveis exportadas da lista abaixo;
- publica todas as pastas de `supabase/functions` (exceto `_shared`) com `--use-api`, sem precisar de Docker.

## Segredos opcionais

| Variável | Uso |
|---|---|
| `LOVABLE_API_KEY`, `LOVABLE_BASE_URL` | Preenchimento e diagnóstico pelo formulário antigo (Gemini) |
| `OPENAI_BASE_URL` | Endpoint alternativo da OpenAI (ex.: mock em testes) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `INVITE_FROM_EMAIL` | Envio de convites por Resend |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL` | Envio de convites por SMTP |
| `INVITE_APP_BASE_URL`, `INVITE_EXPIRATION_HOURS` | Link e validade dos convites |
| `AI_RATE_LIMIT_REQUESTS`, `AI_RATE_LIMIT_WINDOW_SECONDS`, `AI_CONCURRENCY_LIMIT` | Limites de uso de IA por usuário e empresa |

## Depois de uma troca de versão

Funções removidas do repositório continuam publicadas até serem apagadas. A `ai-interview` foi substituída pela `ai-interview-roteiro`; depois que o front novo estiver no ar:

```bash
supabase functions delete ai-interview --project-ref <ref>
```
