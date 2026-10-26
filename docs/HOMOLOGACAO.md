# Homologação — entrevista guiada, relatório e ciclo do processo

Este guia cobre a validação das mudanças da entrevista guiada (roteiro em 6 etapas), do relatório em PDF e do ciclo de vida do processo antes de irem para produção.

- **Parte 1 — Ambiente de teste:** para quem faz o deploy.
- **Parte 2 — Testes automáticos:** opcional, roda numa stack Supabase local com a IA simulada.
- **Parte 3 — Roteiro de teste manual:** para quem conhece a metodologia (Piero) e para quem for testar o produto.
- **Parte 4 — Critérios para ir para produção.**

---

## Parte 1 — Ambiente de teste

Use um projeto Supabase **separado da produção**. As migrations novas convertem os status dos processos e criam uma constraint; elas devem rodar primeiro num banco de teste.

1. Crie um projeto no painel da Supabase (ex.: `process-ai-homologacao`) e anote o ref e a senha do banco.
2. Aplique tudo pelo script:

   ```bash
   export SUPABASE_PROJECT_REF=<ref do projeto de teste>
   export SUPABASE_DB_PASSWORD=<senha>
   export OPENAI_API_KEY=<chave>
   export LOVABLE_API_KEY=<chave>        # ainda usada pelo formulário antigo
   bash scripts/deploy-supabase.sh --dry-run
   bash scripts/deploy-supabase.sh
   ```

3. Aponte o front para o projeto de teste criando um `.env.local` na raiz (ele é ignorado pelo git e tem prioridade sobre o `.env`):

   ```
   VITE_SUPABASE_PROJECT_ID=<ref>
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon key do projeto de teste>
   ```

4. Rode `npm run dev`, crie uma conta e uma empresa.

Para testar a conversão dos dados antigos, copie para o projeto de teste alguns processos reais de produção (com status `Rascunho`, `Em revisão` e `Aprovado`) **antes** do passo 2.

---

## Parte 2 — Testes automáticos (stack local)

O `scripts/security-integration.mjs` verifica isolamento entre empresas (RLS), autenticação e autorização das edge functions, limites de uso de IA, o ciclo de vida e um turno completo da entrevista guiada. A IA é simulada pelo `scripts/mock-ai-server.mjs`; nenhuma chamada sai para a OpenAI.

Requer Docker e o Supabase CLI. A stack local usa cerca de 2–3 GB de RAM.

```bash
supabase start                                   # sobe banco, auth e API locais e aplica as migrations
MOCK_AI_DELAY_MS=1500 node scripts/mock-ai-server.mjs &

cat > supabase/.env.homologacao.local <<'EOF'
OPENAI_API_KEY=mock
OPENAI_BASE_URL=http://host.docker.internal:54329/v1
LOVABLE_API_KEY=mock-lovable-key
LOVABLE_BASE_URL=http://host.docker.internal:54329/v1
EOF
supabase functions serve --env-file supabase/.env.homologacao.local &

# chaves impressas pelo `supabase start` (ou `supabase status`)
SUPABASE_ANON_KEY=<anon key> SUPABASE_SERVICE_ROLE_KEY=<service role key> npm run test:security:integration

supabase stop
```

O atraso do mock (`MOCK_AI_DELAY_MS`) é necessário: o teste de concorrência espera que duas chamadas ainda estejam em andamento quando a terceira chega. O teste cria usuários e empresas fixos; rode-o num banco local limpo (`supabase db reset`).

---

## Parte 3 — Roteiro de teste manual

Use processos reais, que o testador conhece bem: a qualidade das perguntas e do diagnóstico só aparece com casos verdadeiros. Anote em cada caso o resultado e, quando algo não estiver bom, **o que o Peter disse e o que deveria ter dito**.

Durante os testes, anote também:

- o tempo de resposta do Peter em cada turno (normal: poucos segundos; anote os acima de 15 s);
- o custo de uma entrevista completa, pelo painel de uso da OpenAI.

### A. Entrevista guiada completa

| # | Como testar | O que esperar | OK? |
|---|---|---|---|
| A1 | Nova entrevista → "Entrevista guiada". Responda tudo até o fim. | Uma pergunta por vez; a barra mostra "Etapa x de 6". | |
| A2 | Em duas perguntas, responda de forma vaga ("depende", "várias coisas"). | O Peter pede exatamente o que falta, com um exemplo. Na segunda resposta vaga seguida, ele registra como pendente e segue. | |
| A3 | Nas perguntas de escolha (classificação, frequência) e de sim/não, use os botões. | O botão responde e a entrevista avança. | |
| A4 | Na pergunta das atividades, descreva uma atividade por vez e encerre com "O processo termina aqui". | Ele pergunta "qual é a próxima atividade" até você encerrar. Atividades registradas como verbo + objeto. | |
| A5 | Responda "não há aprovação". | As perguntas sobre aprovador e aprovação negada não aparecem. | |
| A6 | Observe os avisos ⚠️ e 💡 ao longo da conversa. | Fazem sentido e se baseiam no que você disse. | |
| A7 | Confira o resumo no fim de cada etapa. | ✅ para o que foi dito, ❓ para o que ficou pendente, sem nada inventado. | |
| A8 | **Diagnóstico (Etapa 5).** Leia com atenção. | Cada achado se apoia no que foi dito e cita o fundamento (Lean, ISO 9001, BPM). Maturidade coerente. **Nada apresentado como fato que você não informou.** | |
| A9 | **Plano (Etapa 6).** | Respeita as prioridades, restrições e prazo informados. "Quem" é cargo ou área, não nome inventado. | |
| A10 | Termine e clique em "Ver relatório e mapa AS IS". | O mapa BPMN é gerado e o processo fica em "Melhorias aprovadas". | |

### B. Ajustes e correções

| # | Como testar | O que esperar | OK? |
|---|---|---|---|
| B1 | No resumo de uma etapa, corrija algo ("a área é Financeiro, não Compras"). | O resumo volta atualizado e pede confirmação de novo. | |
| B2 | No resumo da Etapa 3, mude "não há aprovação" para "há aprovação do gerente". | Antes de confirmar, o Peter pergunta quem aprova e o que acontece se negar. | |
| B3 | No diagnóstico, discorde de um achado ("isso não procede porque…"). | O diagnóstico é refeito levando em conta o que você disse. | |
| B4 | No diagnóstico, só pergunte algo ("o que é desperdício de espera?"). | O Peter responde e pede a confirmação, sem refazer a análise. | |

### C. Outras formas de começar

| # | Como testar | O que esperar | OK? |
|---|---|---|---|
| C1 | "Colar um texto" com uma descrição informal ou procedimento antigo. | O Peter informa o que identificou e pergunta só o que faltou. Confira se o que ele extraiu está correto. | |
| C2 | "Anexar arquivo" com um PDF e um DOCX. | Idem C1. | |
| C3 | Anexe um PDF escaneado (imagem). | O texto é lido por OCR; se não houver texto legível, aparece uma mensagem clara. | |
| C4 | No meio da entrevista, anexe um documento com informações das etapas seguintes. | As perguntas já respondidas pelo documento são puladas. | |

### D. Retomada e falhas

| # | Como testar | O que esperar | OK? |
|---|---|---|---|
| D1 | Feche o navegador no meio da Etapa 3. Reabra pela lista de processos ("Retomar entrevista"). | Continua na mesma pergunta, com o histórico. | |
| D2 | Feche a página enquanto o diagnóstico está sendo gerado e reabra. | O diagnóstico é gerado ao reabrir. | |
| D3 | Desligue a internet e envie uma resposta. | Aparece um erro, sua resposta volta para o campo e nada se perde. | |
| D4 | Envie uma resposta com palavrão. | A mensagem é bloqueada com aviso. | |

### E. Relatório e PDF

| # | Como testar | O que esperar | OK? |
|---|---|---|---|
| E1 | Abra o processo pela lista (ícone de olho) ou pelo menu Relatórios. | Relatório com todas as seções preenchidas a partir da entrevista. | |
| E2 | Confira SIPOC, atividades, decisões, medição, diagnóstico e plano contra o que foi dito. | Tudo corresponde à entrevista. | |
| E3 | "Baixar PDF" → "Salvar como PDF" no Chrome e em outro navegador. | PDF em A4, sem menu lateral, sem tabela cortada, títulos junto do conteúdo, mapa nítido. | |
| E4 | Abra no celular. | Leitura confortável, sem rolagem horizontal. | |

### F. Ciclo do processo e documentação

| # | Como testar | O que esperar | OK? |
|---|---|---|---|
| F1 | Processo em "Melhorias aprovadas": tente "Criar procedimento". | Botão desabilitado, com a explicação. | |
| F2 | "Marcar como implementado" → confirmar. | Status muda para "Implementado"; "Criar procedimento" é liberado. | |
| F3 | Gere o procedimento em Documentos. | O processo aparece na lista de vínculo e o documento é gerado. | |
| F4 | "Voltar para melhorias aprovadas" e depois "Tornar obsoleto" (num processo implementado). | Cada ação pede confirmação e muda o status. | |
| F5 | Processos antigos (migrados). | `Rascunho` → "Em entrevista", `Em revisão` → "Diagnosticado", `Aprovado` → "Implementado". Documentos já existentes continuam acessíveis. | |

### G. Segurança entre empresas

| # | Como testar | O que esperar | OK? |
|---|---|---|---|
| G1 | Com um usuário de outra empresa, abra a URL de um processo da primeira empresa. | "Processo não encontrado". | |
| G2 | Com um usuário de outra empresa, tente retomar a entrevista pela URL. | A entrevista não abre. | |

---

## Parte 4 — Critérios para ir para produção

- Todos os casos das partes A a G aprovados, ou com correção combinada.
- Piero aprova o texto das perguntas e a qualidade do diagnóstico e do plano em pelo menos **três processos reais** diferentes.
- Nenhum caso de dado inventado apresentado como fato no diagnóstico ou no plano.
- Tempo de resposta e custo por entrevista aceitáveis.
- Deploy em produção seguindo o `DEPLOY_SUPABASE.md`: migrations, functions e front em sequência, e remoção da função antiga `ai-interview`.
