# Relatório de Auditoria — Peter v5.0
## Data: 12 de agosto de 2026
## Status geral: 🔴 Não conforme

---

## RESUMO EXECUTIVO

Foram verificados 69 critérios funcionais e de conteúdo derivados do checklist fornecido: 21 foram considerados conformes, 16 parcialmente conformes e 32 não conformes. A comparação literal com a fonte oficial não pôde ser concluída porque o arquivo obrigatório `system_prompt_peter_v5.md` não existe no projeto. Ainda assim, todos os requisitos explicitados no briefing de auditoria foram confrontados com o código. Os três pontos mais críticos são: (1) ausência do prompt v5 como fonte versionada e ausência da metodologia de 6 etapas no prompt da entrevista; (2) upload incompatível com o contrato v5 — limitado a PDF/DOCX/imagem, com extração local, sem base64 no array `content`, multimodalidade ou múltiplos arquivos; e (3) geração documental/BPMN incompleta, sem os seis templates canônicos e sem validações estruturais e bloqueio por completude das Etapas 1–3.

> **Limitação de escopo:** o arquivo de referência solicitado, `system_prompt_peter_v5.md`, foi procurado na raiz e em subdiretórios e não foi encontrado. As expressões “o prompt v5 exige” abaixo referem-se aos requisitos transcritos no briefing anexado. Não foi possível validar redação literal, omissões não reproduzidas no briefing ou versão/hash da fonte oficial.

---

## MATRIZ CONSOLIDADA POR BLOCO

| Bloco | Resultado | Evidência resumida |
|---|---|---|
| 1 — Identidade | ⚠️ Parcial | Peter e tom consultivo aparecem, mas faltam as seis referências teóricas e a marca varia entre ProcessHub.App, Piero Garcia Consultoria e ProcessAI Suite. |
| 2 — Regras fundamentais | 🔴 Não conforme | Não há limite explícito de 2 perguntas, confirmação entre etapas, análise em tempo real por etapa nem progresso “Etapa x de 6”. |
| 3 — Modos de entrada | ⚠️ Parcial | Entrevista, texto único e anexo existem; contrato, formatos, multimodalidade, múltiplos arquivos, POP e modo misto não estão completos. |
| 4 — Metodologia de 6 etapas | 🔴 Não conforme | A entrevista usa 3 fases de campos e o diagnóstico usa outras 6 fases, diferentes da metodologia v5. |
| 5 — Extração automática | ⚠️ Parcial | Há extração ampla do “textão” e do texto OCR, mas não tabela por etapa, ✅/❓, normalização de verbos ou lacunas estruturadas. |
| 6 — Documentos | 🔴 Não conforme | Gerador é genérico; não implementa contratos próprios para os 6 documentos. BPMN possui somente parte das regras. |
| 7 — Mensagens | 🔴 Não conforme | Abertura não oferece 3 opções; não há transições confirmadas nem conclusão com 6 documentos. |
| 8 — Restrições | ⚠️ Parcial | Não inventar e redirecionar fora de escopo estão presentes; demais restrições são ausentes ou contraditórias. |
| 9 — Upload na UI | ⚠️ Parcial | Componente e estado de processamento existem; faltam base64, array multimodal, tamanho, formatos e erro específico. |
| 10 — Consistência | ⚠️ Parcial | Configs e `company_id` são geralmente corretos, mas defaults duplicados divergem e há nomenclatura legada. |

---

## DIVERGÊNCIAS ENCONTRADAS

### 🔴 CRÍTICAS (bloqueiam funcionalidade ou contradizem a metodologia)

| # | Item | O que diz o prompt v5 | O que está implementado | Arquivo(s) afetado(s) |
|---|---|---|---|---|
| 1 | Fonte oficial ausente | `system_prompt_peter_v5.md` deve ser a referência da implementação e auditoria. | O arquivo não existe na raiz nem foi localizado em subdiretórios. Não há fonte versionada capaz de provar conformidade literal. | `system_prompt_peter_v5.md` (ausente) |
| 2 | Metodologia da entrevista | Condução em 6 etapas: Identificação; SIPOC; Atividades + decisões; Indicadores; Gargalos/riscos; Redesenho + 5W2H. | O prompt define `FASE 1`, `FASE 2` e `FASE 3` apenas como ordem de campos (`ai-interview`, linhas 266–269). Não define as seis etapas, perguntas-guia, análises e saídas. | `supabase/functions/ai-interview/index.ts:266` |
| 3 | Confirmação antes de avançar | Peter deve resumir e obter confirmação explícita antes de toda transição de etapa. | Não existe regra de confirmação. `nextQuestion` avança para o próximo campo vazio e a UI aplica atualizações automaticamente (`ai-interview`, linhas 264 e 286–297; `EntrevistaProcesso`, linhas 640–647). | `supabase/functions/ai-interview/index.ts:257`; `src/pages/EntrevistaProcesso.tsx:640` |
| 4 | Proibição de inventar | Nenhum dado não informado pode ser criado; lacunas devem ser marcadas. | O prompt permite “sugerir riscos prováveis” (linha 246), gerar indicadores/ações (247–249 e 297) e o diagnóstico manda “Infira automaticamente” (linhas 322–327) e completar o 5W2H mesmo incompleto (linha 310). Isso contradiz a restrição absoluta, ainda que outras linhas digam “nunca invente”. | `supabase/functions/ai-interview/index.ts:210`; `supabase/functions/ai-interview/index.ts:246`; `supabase/functions/ai-diagnose-process/index.ts:309`; `src/pages/EntrevistaProcesso.tsx:509` |
| 5 | Upload conforme contrato OpenAI | Arquivo em base64 no campo `content`, com suporte multimodal e tipos PDF, DOC/DOCX, TXT, XLSX/CSV, PPTX, PNG/JPG. | A UI extrai texto localmente e envia uma mensagem `content: string`; o tipo da edge function também restringe `content` a string (`ai-interview`, linhas 12–15 e 319–322). Só PDF, DOCX e imagens são aceitos. | `src/pages/EntrevistaProcesso.tsx:910`; `src/pages/EntrevistaProcesso.tsx:945`; `supabase/functions/ai-interview/index.ts:12` |
| 6 | Interpretação de fluxograma | Imagens devem ser interpretadas visualmente como fluxogramas. | A imagem passa por OCR Tesseract e apenas o texto reconhecido é enviado (linhas 939–963); geometria, conectores, raias e gateways não chegam ao modelo. | `src/pages/EntrevistaProcesso.tsx:939` |
| 7 | BPMN condicionado à completude | Bloquear XML até as Etapas 1, 2 e 3 estarem completas. | A validação aceita somente `etapas` **ou** qualquer `resumo` (linhas 39–46). Não valida identificação, SIPOC, responsáveis, entradas/saídas ou decisões. | `supabase/functions/ai-generate-bpmn/index.ts:39` |
| 8 | BPMN 2.0 completo | Pool/lanes, task types, gateways exclusivo/paralelo, boundary/timer events, eventos inicial/final e nomes Verbo + Objeto. | O prompt exige StartEvent, EndEvent, Tasks e ExclusiveGateway (linhas 70–82), mas não exige pool/lanes, User/Service Task, ParallelGateway, BoundaryEvent, TimerEventDefinition ou convenção Verbo + Objeto. | `supabase/functions/ai-generate-bpmn/index.ts:70` |
| 9 | Seis documentos canônicos | POP, RACI validada, Diagnóstico, 5W2H, BPMN XML e Ficha do Processo devem possuir geração/template correto. | `ai-generate-document` é um gerador markdown genérico baseado em template recebido (linhas 99–121). Não possui contratos por tipo, validação R/A ou estruturas canônicas. BPMN fica em outra função. Busca no catálogo encontrou POP/Plano, mas não templates canônicos para RACI e Ficha do Processo. | `supabase/functions/ai-generate-document/index.ts:99`; `src/data/documentation-config.ts:24`; `supabase/functions/ai-generate-bpmn/index.ts` |
| 10 | Abertura com três opções | A mensagem inicial deve oferecer entrevista guiada, texto livre e anexo. | A UI saúda, tranquiliza e pergunta o nome (linhas 205–215); não apresenta as três opções. Depois obriga nome, processo e “texto único” (linhas 593–613). | `src/pages/EntrevistaProcesso.tsx:205`; `supabase/functions/ai-interview/index.ts:212` |
| 11 | Progresso por etapa | Peter deve sinalizar “Etapa x de 6”. | A UI exibe porcentagem calculada por campos preenchidos (linha 1092), não etapa metodológica. O prompt não manda anunciar etapa. | `src/pages/EntrevistaProcesso.tsx:385`; `src/pages/EntrevistaProcesso.tsx:1092` |
| 12 | Diagnóstico alinhado às seis etapas v5 | A análise deve acompanhar a metodologia e concentrar Lean, ISO e maturidade na Etapa 5. | O diagnóstico cria uma taxonomia diferente: mapeamento, diagnóstico, maturidade, TO-BE, 5W2H e KPIs (linhas 275–315). Maturidade está na Fase 3; 5W2H na Fase 5; KPIs na Fase 6. | `supabase/functions/ai-diagnose-process/index.ts:275` |

### 🟡 RELEVANTES (funcionalidade parcial ou comportamento incorreto)

| # | Item | O que diz o prompt v5 | O que está implementado | Arquivo(s) afetado(s) |
|---|---|---|---|---|
| 1 | Identidade e referências | Peter deve ser assistente de entrevistas fundamentado em BPM/BPMN, ISO 9001, Lean, Porter, Drucker e metodologia própria. | Peter, BPM e ISO 9001 aparecem nos defaults; Lean, Porter, Drucker e metodologia própria não aparecem no prompt operacional. O prompt de edge cita ProcessHub.App, enquanto o default de UI cita Piero Garcia Consultoria. | `src/data/ai-config-defaults.ts:20`; `supabase/functions/ai-interview/index.ts:137` |
| 2 | Máximo de perguntas | Máximo de 2 perguntas por mensagem. | Defaults dizem “Uma pergunta por vez” ou “perguntas curtas”, mas a edge function não contém limite obrigatório de 2. Mensagens longas podem conter vários pedidos (“etapas, responsáveis, ferramentas...”). | `src/data/ai-config-defaults.ts:29`; `supabase/functions/ai-interview/index.ts:129`; `src/pages/EntrevistaProcesso.tsx:610` |
| 3 | Análise em tempo real | Sinalizar problemas e oportunidades durante cada etapa. | O sistema extrai e preenche campos, mas não instrui o Peter a emitir alertas `⚠️` e oportunidades `💡` em tempo real. Diagnóstico ocorre ao final. | `supabase/functions/ai-interview/index.ts:195`; `src/pages/ProcessoResultadoGuiado.tsx:76` |
| 4 | Adaptação de vocabulário | Ajustar o vocabulário ao usuário. | Há linguagem consultiva e permissão para jargões configuráveis, mas nenhuma regra explícita para detectar e adaptar ao nível/vocabulário do entrevistado. | `supabase/functions/ai-interview/index.ts:137`; `src/pages/ConfigRoteiroEntrevista.tsx:166` |
| 5 | Modo texto livre | Extrair informação por cada uma das 6 etapas e complementar só lacunas. | O “textão” é tratado como AS-IS e o prompt manda preencher o máximo e perguntar lacunas (linhas 230–233), mas não há matriz de extração por 6 etapas. | `supabase/functions/ai-interview/index.ts:230`; `src/pages/EntrevistaProcesso.tsx:617` |
| 6 | Modo anexo | Detectar erro/corrupção, POP antigo, múltiplos arquivos e preservar modo misto. | Há `try/catch` genérico e extração de um único arquivo. Não há detecção semântica de POP, fila/múltiplos anexos ou estado explícito de fontes combinadas. O conteúdo extraído entra no mesmo histórico, o que oferece combinação básica, mas não rastreada. | `src/pages/EntrevistaProcesso.tsx:945`; `src/pages/EntrevistaProcesso.tsx:992`; `src/pages/EntrevistaProcesso.tsx:1142` |
| 7 | Formatos de anexo | Cobrir `.pdf`, `.doc`, `.docx`, `.txt`, `.xlsx`, `.csv`, `.pptx`, `.png`, `.jpg`. | `accept` e handlers cobrem `.pdf`, `.docx` e imagens; não cobrem DOC, TXT, XLSX, CSV e PPTX. | `src/pages/EntrevistaProcesso.tsx:950`; `src/pages/EntrevistaProcesso.tsx:1144` |
| 8 | Resumo estruturado | Extração deve produzir resumo com ✅ informado e ❓ lacuna. | `partialUpdate` e `nextQuestion` existem, porém não há estrutura, schema ou apresentação ✅/❓. | `supabase/functions/ai-interview/index.ts:282`; `src/pages/EntrevistaProcesso.tsx:1106` |
| 9 | Normalização de atividades | Normalizar atividades em Verbo + Objeto. | Há parsing de pares/listas, mas nenhuma instrução de normalização. O importador PDF copia linhas como atividade. | `supabase/functions/ai-interview/index.ts:290`; `src/pages/ProcessoFormulario.tsx:864` |
| 10 | Análise Lean/ISO | Etapa 5 deve aplicar os 8 desperdícios Lean e critérios ISO 9001. | O diagnóstico classifica “valor agregado/suporte/desperdício”, mas não enumera os 8 desperdícios nem aplica critérios ISO 9001. | `supabase/functions/ai-diagnose-process/index.ts:289`; `src/data/ai-config-defaults.ts:20` |
| 11 | Maturidade | Etapa 5 deve usar escala Inicial → Otimizado. | Existe maturidade digital 0–4 com rótulos Analógico → Inteligente, semanticamente distinta e posicionada na Fase 3. | `supabase/functions/ai-diagnose-process/index.ts:292` |
| 12 | Transições e conclusão | Resumir, confirmar e concluir listando os 6 documentos. | A aplicação salva/aplica automaticamente quando `done`; não foi localizada mensagem final com os seis documentos nem padrão de transição. | `src/pages/EntrevistaProcesso.tsx:643`; `src/pages/EntrevistaProcesso.tsx:689` |
| 13 | Nome Peter em todos os prompts | Todos os system prompts devem identificar o agente como Peter. | Entrevista/fill/diagnóstico carregam skin Peter, mas `ai-generate-document` diz apenas “consultor sênior” e `ai-generate-bpmn` apenas “especialista em modelagem BPMN”. | `supabase/functions/ai-generate-document/index.ts:99`; `supabase/functions/ai-generate-bpmn/index.ts:70` |
| 14 | Defaults duplicados | Defaults do frontend e edge functions devem estar alinhados. | `DEFAULT_SKIN_IDENTITY` do frontend descreve Piero Garcia Consultoria, BPM e ISO (linhas 20–38); defaults duplicados nas edges descrevem ProcessHub.App e não ISO. Alterar um não altera os demais. | `src/data/ai-config-defaults.ts:20`; `supabase/functions/ai-interview/index.ts:129`; `supabase/functions/ai-diagnose-process/index.ts:209`; `supabase/functions/ai-fill-process/index.ts:37` |
| 15 | Contrato JSON inconsistente | A mecânica obrigatória deve ter um único schema inequívoco. | O texto exige chaves em ordem `avaliacao_comportamento`, `avaliacao_conteudo`, `isValid`, `partialUpdate`, `nextQuestion` (linhas 257–264), mas logo depois exige outro formato com `raciocinio`, sem as duas avaliações, e inclui `done` (linhas 282–289). | `supabase/functions/ai-interview/index.ts:257` |
| 16 | Limite e feedback de upload | UI deve limitar tamanho/tipo e informar processamento/erro específico. | Tipo é limitado pelo `accept` e o botão fica em estado global “Aguarde”, mas não há limite de bytes, validação explícita antes de ler, mensagem “processando arquivo”, nem toast de formato não suportado no `else` (retorno silencioso na linha 957). | `src/pages/EntrevistaProcesso.tsx:945`; `src/pages/EntrevistaProcesso.tsx:1121` |

### 🟢 AUSÊNCIAS (funcionalidades previstas no prompt que não existem ainda)

| # | Item ausente | Onde deveria estar | Impacto |
|---|---|---|---|
| 1 | Arquivo `system_prompt_peter_v5.md` | Raiz do projeto | Impede rastreabilidade, revisão literal e controle de versão da especificação. |
| 2 | Seis referências teóricas completas | Skin/default e prompts das edge functions | Análises não ficam obrigatoriamente fundamentadas em Lean, Porter, Drucker e metodologia própria. |
| 3 | Regra explícita de máximo 2 perguntas | `ai-interview/index.ts` | O modelo pode produzir mensagens sobrecarregadas. |
| 4 | Confirmação/resumo entre etapas | Prompt, schema de resposta e UI | Peter pode avançar sem anuência do entrevistado. |
| 5 | Progresso “Etapa x de 6” | Prompt e UI | Usuário vê apenas porcentagem de campos, não posição metodológica. |
| 6 | Metodologia v5 completa por etapa, com perguntas, análise e saída | `ai-interview/index.ts` e defaults | A entrevista não executa o método de referência. |
| 7 | Matriz de extração das 6 etapas | Prompt/schema de extração | Texto/anexos não produzem cobertura auditável por etapa. |
| 8 | Marcadores ✅/❓ e lacunas estruturadas | Resposta da edge e chat | Usuário não distingue claramente evidência extraída de informação pendente. |
| 9 | Suporte DOC, TXT, XLSX, CSV e PPTX | UI e edge de ingestão | Arquivos previstos não podem ser usados. |
| 10 | Envio base64/multimodal no array `content` | UI e `ai-interview` | O Assistant não recebe o arquivo original; perde layout, tabelas e elementos visuais. |
| 11 | Múltiplos arquivos e rastreabilidade de fonte | UI, estado da entrevista e API | Não há análise consolidada controlada nem citação da origem. |
| 12 | Detecção de POP/procedimento antigo | Pipeline de ingestão | Não há tratamento específico de documentação preexistente. |
| 13 | Interpretação visual de fluxograma | Pipeline multimodal | OCR não preserva conexões e semântica gráfica. |
| 14 | 8 desperdícios Lean | Etapa 5/diagnóstico | Análise Lean incompleta. |
| 15 | Critérios ISO 9001 aplicados | Etapa 5/diagnóstico | Citação de expertise não se traduz em verificação normativa. |
| 16 | Escala Inicial → Otimizado | Etapa 5/diagnóstico | Maturidade calculada usa outra taxonomia. |
| 17 | Templates canônicos RACI, Diagnóstico, BPMN e Ficha | Catálogo/gerador documental | Os seis entregáveis não são gerados de forma padronizada. |
| 18 | Validação RACI de exatamente um A e ao menos um R | Gerador/schema documental | Matriz pode ser inválida ou não existir. |
| 19 | Pool e lanes BPMN | `ai-generate-bpmn/index.ts` | Áreas/responsabilidades não são separadas formalmente. |
| 20 | User Task e Service Task | `ai-generate-bpmn/index.ts` | Tipo de execução não é representado. |
| 21 | Parallel Gateway | `ai-generate-bpmn/index.ts` | Paralelismo não tem regra de modelagem. |
| 22 | Boundary e Timer Boundary Events | `ai-generate-bpmn/index.ts` | Exceções e SLAs não são modelados conforme v5. |
| 23 | Regra Verbo + Objeto | Entrevista e BPMN | Nomenclatura pode ficar inconsistente. |
| 24 | Bloqueio BPMN por Etapas 1–3 | Validação server-side | XML pode ser gerado com dados insuficientes. |
| 25 | Mensagens padrão ⚠️ e 💡 | Prompt/UI | Problemas e oportunidades não são sinalizados no formato esperado. |
| 26 | Conclusão listando seis documentos | Prompt/UI | Usuário não recebe o fechamento previsto. |
| 27 | Proibição do termo “processo perfeito” | Todos os prompts | Restrição absoluta não está codificada. |
| 28 | Fundamentação obrigatória nos frameworks | Prompts de entrevista/diagnóstico | Insights podem sair sem justificativa metodológica. |

---

## ITENS CONFORMES

- O nome **Peter** aparece na abertura, no chat, nos estados de digitação e conclusão, e nos defaults de identidade (`EntrevistaProcesso.tsx`, linhas 205–215 e 1106–1115; `ai-config-defaults.ts`, linha 20).
- O papel geral de facilitador/assistente de mapeamento e melhoria de processos está descrito de forma coerente (`ai-interview/index.ts`, linhas 137–141).
- O tom profissional, humano, didático, acolhedor, consultivo e objetivo está amplamente definido nos defaults e na skin configurável.
- Entrevista guiada é o fluxo principal da tela e solicita nome do participante, nome do processo e descrição AS-IS.
- Texto livre extenso é suportado e tratado como fonte principal; o prompt orienta aproveitar o que já foi informado e perguntar lacunas (`ai-interview/index.ts`, linhas 230–245).
- Existe componente de upload na tela da entrevista para PDF, DOCX e imagem (`EntrevistaProcesso.tsx`, linhas 1140–1151).
- Há extração local de PDF via PDF.js, DOCX via Mammoth e imagem via OCR Tesseract (`EntrevistaProcesso.tsx`, linhas 910–955).
- Exceções de leitura são capturadas, embora o retorno ao usuário seja genérico (`EntrevistaProcesso.tsx`, linhas 992–1000).
- O conteúdo de anexos entra no mesmo histórico e pode complementar respostas anteriores, fornecendo um modo misto básico.
- O prompt orienta não reiniciar o questionário após o texto livre e fazer perguntas focadas em lacunas (`ai-interview/index.ts`, linhas 230–233).
- Decisões estão integradas ao conjunto de atividades/campos, não modeladas como uma sétima etapa isolada (`ai-interview/index.ts`, linhas 267–269).
- SIPOC está representado por entradas/fornecedores e saídas/clientes no schema e formulário.
- O plano de ação utiliza os sete campos 5W2H (`ai-interview/index.ts`, linhas 278–279).
- Existe cálculo e exibição visual de progresso, embora não no formato metodológico requerido.
- A regra de não avançar quando a resposta é inválida ou insuficiente está explícita (`ai-interview/index.ts`, linhas 202–210).
- Há redirecionamento para respostas ofensivas ou totalmente fora de contexto (`ai-interview/index.ts`, linhas 254–255).
- O gerador documental orienta usar somente dados fornecidos e marcar “não informado” (`ai-generate-document/index.ts`, linhas 103–110).
- O BPMN exige XML puro, namespaces, StartEvent, EndEvent, Tasks, ExclusiveGateway, SequenceFlow e BPMNDiagram com coordenadas (`ai-generate-bpmn/index.ts`, linhas 70–82).
- `useAiConfig` suporta os três tipos `route_script`, `skin_identity` e `skin_validation`, com leitura e fallback por empresa (`ai-config-defaults.ts`, linha 1; `useAiConfig.ts`, linhas 60–107).
- As principais chamadas analisadas enviam contexto empresarial: entrevista, preenchimento, diagnóstico, BPMN e documentos. As edge functions validam/derivam `company_id` e autorizam a empresa.
- A configuração de skin permite editar separadamente identidade e validação e salva os dois blocos (`ConfigSkinIA.tsx`, linhas 14–45).

---

## OBSERVAÇÕES ADICIONAIS

1. **Dois produtos/marcas coexistem.** Os prompts operacionais usam `ProcessHub.App`; o default de frontend usa “Piero Garcia Consultoria”; `ai-review-config` ainda contém “ProcessAI Suite”. Isso não troca o nome Peter, mas fragiliza identidade e governança de prompt.

2. **A configuração da empresa pode substituir requisitos globais.** `customScript` e `validationRules` são injetados como “prioritários” (`ai-interview/index.ts`, linhas 195–197). Sem um núcleo v5 imutável e posterior às customizações, um tenant pode remover ou contradizer regras absolutas.

3. **O schema obrigatório do prompt é internamente contraditório.** A seção “MECÂNICA” exige cinco chaves e avaliações separadas, enquanto o JSON de exemplo exige `raciocinio` e `done` e omite essas avaliações. Isso aumenta a chance de parse inconsistente e reduz a auditabilidade da validação.

4. **A validação de resposta é excessivamente rígida e distinta do v5.** `isValid` só pode ser verdadeiro quando comportamento e conteúdo forem “excelentes” (`ai-interview/index.ts`, linhas 260–263), o que pode rejeitar respostas úteis e conflita com postura inclusiva/adaptativa.

5. **O fallback local inventa conteúdo operacional.** A UI contém riscos, indicadores e ações genéricos predefinidos (`EntrevistaProcesso.tsx`, a partir das linhas 509, 543 e 568). Isso é funcionalmente útil, mas contradiz a restrição absoluta de não gerar dados não informados se esses itens forem consolidados sem marcação de hipótese.

6. **`ai-fill-process` usa outra pilha/modelo no caminho padrão.** A função chama Lovable com `google/gemini-2.5-flash` e não recebe `use_peter_assistant` nessa chamada de formulário (`ProcessoFormulario.tsx`, linhas 436–441). Portanto, nem toda automação de preenchimento é efetivamente conduzida pelo mesmo Assistant Peter/OpenAI descrito no contexto.

7. **`ai-diagnose-process` também possui dois caminhos.** O formulário manual não envia `use_peter_assistant`, usando o caminho Lovable/Gemini; a experiência guiada envia `true` e usa o Assistant configurado. O comportamento varia conforme a rota de entrada.

8. **`company_id` está presente nas chamadas críticas analisadas**, mas `ai-generate-document` o recebe aninhado como `companyContext.companyId`, diferente do contrato das outras funções. Funciona com o código atual, porém aumenta a chance de integração incorreta por falta de contrato uniforme.

9. **Upload de roteiro não equivale a upload de entrevista.** `ConfigRoteiroEntrevista.tsx` também importa PDF/DOCX/imagem, mas apenas concatena texto ao prompt configurável; não satisfaz requisitos de anexos do entrevistado.

10. **Truncamento silencioso:** anexos são cortados em 16.000 caracteres (`EntrevistaProcesso.tsx`, linha 959), sem avisar ao usuário. Partes relevantes podem ser descartadas.

11. **Arquivo sem texto:** ao contrário da tela de configuração, a entrevista não verifica explicitamente `snippet` vazio antes de enviar. Uma imagem ilegível ou PDF sem texto pode gerar uma mensagem vazia contextualizada e resposta imprevisível.

12. **Sem validação XML real:** o BPMN é considerado válido se contiver `<bpmn:definitions` ou `<definitions` (`ai-generate-bpmn/index.ts`, linhas 158–164). Não há parsing XML, validação contra schema BPMN 2.0 ou verificação dos elementos obrigatórios prometidos.

---

## PRÓXIMOS PASSOS SUGERIDOS (sem implementar — apenas listar)

1. Adicionar e versionar o `system_prompt_peter_v5.md` oficial, com versão, data e hash; definir quais trechos são imutáveis e quais são customizáveis por tenant.
2. Consolidar um único construtor de prompt compartilhado para entrevista, preenchimento, diagnóstico, documentos e BPMN, eliminando defaults duplicados e contradições de marca/schema.
3. Reestruturar `ai-interview` em uma máquina de estados explícita de 6 etapas, com `currentStage`, cobertura, resumo, confirmação, lacunas, alertas e progresso.
4. Resolver a política de não invenção: separar claramente **dado informado**, **inferência**, **hipótese** e **sugestão**, exigindo confirmação antes de consolidar os três últimos.
5. Implementar ingestão de arquivos com contrato multimodal seguro, formatos previstos, limites de tamanho, múltiplos arquivos, erros específicos, rastreabilidade de fonte e preservação de tabelas/layout.
6. Criar extração estruturada por etapa com marcadores ✅/❓, normalização Verbo + Objeto e perguntas somente para lacunas.
7. Alinhar o diagnóstico à metodologia v5: oito desperdícios Lean, critérios ISO 9001 e maturidade Inicial → Otimizado na Etapa 5; redesenho e 5W2H na Etapa 6.
8. Criar contratos/templates dedicados para POP, RACI, Diagnóstico, 5W2H, BPMN XML e Ficha do Processo, com validadores específicos.
9. Reforçar BPMN com pool/lanes, tipos de task, gateways paralelo/exclusivo, boundary/timer events, nomenclatura e bloqueio server-side até a conclusão confirmada das Etapas 1–3.
10. Padronizar mensagens de abertura, transição, alerta, oportunidade e conclusão conforme v5.
11. Uniformizar todas as chamadas de IA em torno do Peter/OpenAI ou documentar formalmente quando Lovable/Gemini é permitido; manter `company_id` em contrato consistente.
12. Criar testes automatizados de conformidade do prompt e contratos: snapshots de system prompt, testes de schema JSON, fixtures de cada modo de entrada e validação estrutural de BPMN/RACI.

---

## ARQUIVOS ADICIONAIS RELEVANTES INCLUÍDOS

- `supabase/functions/ai-generate-bpmn/index.ts` — geração efetiva do XML BPMN.
- `supabase/functions/_shared/openai-assistant.ts` — execução do Assistant configurado.
- `supabase/functions/ai-summarize-process/index.ts` — sumarização complementar.
- `supabase/functions/ai-review-config/index.ts` — revisão de roteiro/skin e nomenclatura legada.
- `src/pages/ProcessoResultadoGuiado.tsx` — orquestra diagnóstico e BPMN após entrevista.
- `src/pages/Documentos.tsx` e `src/data/documentation-config.ts` — catálogo, payload e geração documental real.
- `src/components/BPMNCanvas.tsx` — integração da geração BPMN na interface.
