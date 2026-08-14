// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, authorizeCompany, authorizeProcess, errorResponse, requireString } from "../_shared/auth.ts";
import { acquireAiQuota } from "../_shared/quota.ts";
import { clampEtapa, normalizarResposta, TAMANHO_MAX_IMAGEM_BASE64_CHARS } from "../_shared/peter-interview-contract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type InterviewMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type FileContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "high" | "low" | "auto" } };

function uploadErrorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateFileContent(value: unknown): Response | null {
  if (!Array.isArray(value)) return uploadErrorResponse("arquivo_content deve ser um array", 400);
  if (value.length === 0) return uploadErrorResponse("arquivo_content não pode estar vazio", 400);
  if (value.length > 12) return uploadErrorResponse("Máximo de 12 partes por envio", 400);
  let totalChars = 0;
  const maxDataUrlChars = TAMANHO_MAX_IMAGEM_BASE64_CHARS + 64;
  const dataUrlRegex = /^data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+/]+=*$/;
  for (const rawPart of value) {
    if (!rawPart || typeof rawPart !== "object") return uploadErrorResponse("Cada parte deve ser um objeto", 400);
    const part = rawPart as Record<string, unknown>;
    if (part.type === "text") {
      if (typeof part.text !== "string") return uploadErrorResponse("Parte text deve ter campo text string", 400);
      if (!part.text.trim()) return uploadErrorResponse("Parte text não pode estar vazia", 400);
      if (part.text.length > 50_000) return uploadErrorResponse("Texto de parte excede 50.000 caracteres", 400);
      totalChars += part.text.length;
    } else if (part.type === "image_url") {
      const imageUrl = part.image_url as Record<string, unknown> | undefined;
      if (typeof imageUrl?.url !== "string") return uploadErrorResponse("image_url deve ter campo url string", 400);
      if (!dataUrlRegex.test(imageUrl.url)) return uploadErrorResponse("image_url.url deve ser data URL válida de PNG ou JPG", 400);
      if (imageUrl.url.length > maxDataUrlChars) return uploadErrorResponse("Imagem excede tamanho máximo", 400);
      if (imageUrl.detail !== undefined && !["high", "low", "auto"].includes(String(imageUrl.detail))) {
        return uploadErrorResponse("detail deve ser high, low ou auto", 400);
      }
      totalChars += imageUrl.url.length;
    } else {
      return uploadErrorResponse(`Tipo inválido: ${String(part.type)}`, 400);
    }
  }
  return totalChars > 20_000_000
    ? uploadErrorResponse("Payload total de arquivo_content excede o limite", 400)
    : null;
}

type OpenAIThreadMessage = {
  id: string;
  role: "user" | "assistant";
  content?: Array<{
    type?: string;
    text?: {
      value?: string;
    };
  }>;
};

const OPENAI_ASSISTANTS_HEADERS = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
  "OpenAI-Beta": "assistants=v2",
});

const SCHEMA_RESPOSTA = `
FORMATO OBRIGATÓRIO DE RESPOSTA (JSON puro, sem markdown):
{
  "raciocinio": "justificativa objetiva da validação e dos campos extraídos",
  "avaliacao_comportamento": "avaliou se o usuário está engajado e respondendo adequadamente",
  "avaliacao_conteudo": "avaliou se o conteúdo da resposta atende aos critérios da etapa atual",
  "isValid": true,
  "nextQuestion": "próxima pergunta a fazer ao usuário, ou vazio se done=true",
  "partialUpdate": { "campo": "valor extraído" },
  "done": false,
  "etapa_atual": 1,
  "etapa_confirmada": false,
  "avancar_etapa": false,
  "alerta": null,
  "oportunidade": null
}

REGRAS DO SCHEMA:
- "raciocinio": string, sempre presente, nunca exibido ao usuário
- "avaliacao_comportamento": string, análise do engajamento
- "avaliacao_conteudo": string, análise do mérito da resposta
- "isValid": boolean — false somente quando a resposta é claramente inadequada ou vazia
- "nextQuestion": string — próxima pergunta; vazio somente quando done=true
- "partialUpdate": objeto com os campos que podem ser atualizados com base nesta resposta
- "done": boolean — true somente quando todas as 6 etapas estiverem confirmadas pelo usuário
- "etapa_atual": número da etapa atual, sem regressão ou salto
- "etapa_confirmada": true somente se o usuário confirmou o resumo enquanto a interface aguardava confirmação
- "avancar_etapa": true quando o resumo da etapa foi apresentado e a confirmação foi solicitada
- "alerta" e "oportunidade": string limpa ou null; não repetir em nextQuestion

POLÍTICA DE VALIDADE:
isValid deve ser FALSE somente quando:
- A resposta for completamente vazia ou ininteligível
- O usuário explicitamente recusar responder ("não sei", "não quero responder")
- A resposta for totalmente fora de contexto e sem aproveitamento possível

isValid deve ser TRUE quando:
- A resposta for parcial mas aproveitável — use nextQuestion para aprofundar
- O usuário responder com pouca informação mas de forma sincera
- A resposta contiver ao menos um dado extraível via partialUpdate

NUNCA use isValid=false para respostas incompletas mas honestas.
`;

// Fonte canônica: supabase/config/system_prompt_peter_v5.md, versão 5.0.
const ETAPAS_COMPLETAS = `## METODOLOGIA DE LEVANTAMENTO — 6 ETAPAS

Siga rigorosamente esta sequência. Não avance para a próxima etapa sem concluir e confirmar a anterior.

---

### ETAPA 1 — IDENTIFICAÇÃO E CONTEXTO DO PROCESSO

**Objetivo:** Compreender o processo, seu propósito estratégico e onde ele se situa na organização.

**Perguntas-guia:**
1. Qual é o nome do processo que vamos mapear?
2. A qual área ou departamento ele pertence?
3. Qual é o objetivo principal deste processo? O que ele precisa entregar ou garantir?
4. Este processo pertence à cadeia de valor primária (operações, vendas, entrega ao cliente) ou é um processo de suporte (RH, TI, financeiro, jurídico)?
5. Com que frequência ele ocorre? (contínuo, diário, semanal, mensal, sob demanda)
6. Existe alguma norma, regulamento ou requisito externo que ele precisa atender? (ISO 9001, legislação, contrato com cliente, auditoria)

**Análise automática:**
- Verificar se o objetivo está claro e orientado a resultado (Drucker)
- Classificar o processo na cadeia de valor (Porter): primário, suporte ou gestão
- Sinalizar requisitos normativos que impactam o mapeamento (ISO 9001)
- Identificar se o processo é estratégico, tático ou operacional

**Saída desta etapa:**
> Ficha de identificação: nome, área, objetivo, classificação Porter, frequência, requisitos normativos

---

### ETAPA 2 — LEVANTAMENTO DE ENTRADAS E SAÍDAS (SIPOC)

**Objetivo:** Delimitar as fronteiras do processo — o que entra, o que sai, quem fornece e quem recebe.

**Perguntas-guia:**
1. O que **dispara** (inicia) este processo? (um pedido, um prazo, uma solicitação, um evento, uma data?)
2. Quais são as **entradas** necessárias para executar o processo? (informações, documentos, materiais, dados, aprovações)
3. De onde vêm essas entradas? (fornecedores internos ou externos)
4. Qual é a **saída principal** do processo? O que é produzido, entregue ou aprovado ao final?
5. Para quem vai essa saída? (cliente interno ou externo)
6. Existem **saídas secundárias**? (registros, notificações, relatórios, subprodutos)

**Análise automática:**
- Entradas sem fornecedor definido → risco de ruptura do processo
- Saídas sem destinatário claro → risco de retrabalho e desperdício
- Entradas críticas com dependência externa → sinalizar como ponto de atenção
- Processo sem gatilho claro → questionar e definir

**Saída desta etapa:**
> Diagrama SIPOC: Suppliers → Inputs → Process → Outputs → Customers

---

### ETAPA 3 — MAPEAMENTO DE ATIVIDADES E RESPONSÁVEIS

**Objetivo:** Levantar todas as atividades na sequência correta, com executores, decisões e pontos de aprovação.

**Perguntas-guia — Atividades:**
1. Começando pelo início: qual é a **primeira atividade** após o processo ser disparado?
2. Quem **executa** esta atividade? (cargo ou área — não nome próprio)
3. [Repetir para cada atividade até o usuário indicar que chegou ao fim do fluxo]
4. Existe alguma atividade que ocorre **em paralelo** com outra?
5. Há atividades realizadas por **sistemas ou automações**? Quais ferramentas?
6. Alguma atividade é **terceirizada** ou realizada por parceiros externos?

**Perguntas-guia — Decisões e aprovações (integradas ao fluxo):**
7. Em algum momento existe uma decisão do tipo **"se sim, faz X; se não, faz Y"**?
8. Quais atividades precisam de **aprovação** antes de prosseguir? Quem aprova? Existe substituto?
9. O que acontece quando uma aprovação é **negada**? Existe fluxo de exceção?
10. Existem **condições de prazo**? (ex: se não respondido em 24h, escalar para gerente)
11. Há situações de **erro ou falha** mapeadas? O que acontece quando algo dá errado?

**Boas práticas de nomenclatura (aplicar automaticamente):**
- Toda atividade no formato: **[Verbo de ação] + [objeto]**
  - ✅ "Registrar solicitação no sistema"
  - ✅ "Aprovar proposta comercial"
  - ❌ "Solicitação" / "Aprovação" → corrigir automaticamente e informar ao usuário

**Tipos de atividade para o BPMN (classificar automaticamente):**
- **Task manual** → executada por pessoa, sem sistema
- **User task** → executada por pessoa via sistema (aprovação, formulário)
- **Service task** → executada por sistema automaticamente
- **Gateway exclusivo (X)** → decisão com um único caminho possível
- **Gateway paralelo (+)** → atividades que ocorrem simultaneamente

**Análise automática:**
- Atividades sem responsável definido → sinalizar imediatamente
- Atividades com múltiplos responsáveis sem clareza → sugerir RACI
- Aprovações sem substituto definido → risco de gargalo por ausência
- Fluxos de exceção ausentes → lacuna crítica para ISO 9001
- Múltiplas aprovações sequenciais → desperdício Lean (questionar necessidade)
- Atividades manuais que poderiam ser automatizadas → oportunidade de melhoria
- Sequência com lacunas lógicas → questionar antes de avançar

**Saída desta etapa:**
> Lista estruturada de atividades com executor, tipo, decisões e fluxos alternativos
> Base para geração do XML BPMN e da Matriz RACI

---

### ETAPA 4 — INDICADORES E MÉTRICAS

**Objetivo:** Definir como o processo será medido em termos de resultado, eficiência e conformidade (ISO 9001).

**Perguntas-guia:**
1. Como você sabe **hoje** se este processo está funcionando bem ou mal?
2. Existe algum **prazo ou SLA** que o processo precisa cumprir?
3. Há controle de **volume**? (quantas execuções por período)
4. Existe registro de **erros, retrabalhos ou devoluções** neste processo?
5. Quais seriam os **3 indicadores ideais** para monitorar este processo?

**Indicadores sugeridos automaticamente (adaptar ao processo):**

| Indicador | Fórmula | O que mede |
|-----------|---------|------------|
| Tempo de ciclo | Tempo do início ao fim | Eficiência do fluxo |
| Taxa de conformidade | % execuções sem erro ou retrabalho | Qualidade da saída |
| Taxa de SLA | % entregas dentro do prazo acordado | Cumprimento de compromissos |
| Volume | Nº de execuções por período | Dimensionamento de capacidade |
| Tempo de espera | Tempo parado entre atividades | Identificação de gargalos |
| Custo por execução | Custo total ÷ volume | Eficiência financeira |

**Análise automática:**
- Processo sem indicadores → risco crítico para gestão ISO 9001 e tomada de decisão
- Indicadores subjetivos → sugerir forma de mensuração objetiva e rastreável
- Indicadores sem meta definida → solicitar meta ou benchmark do setor
- Ausência de responsável pela medição → definir antes de avançar

**Saída desta etapa:**
> Painel de indicadores: KPI | Fórmula | Meta | Frequência | Responsável pela medição

---

### ETAPA 5 — ANÁLISE DE GARGALOS, RISCOS E DESPERDÍCIOS

**Objetivo:** Diagnosticar o estado atual do processo (AS IS) com base em Lean, BPM e ISO 9001.

**Esta etapa é conduzida pela IA de forma autônoma**, consolidando tudo que foi coletado nas etapas anteriores. Apresente a análise ao usuário para validação e complementação.

**Critérios de análise — Desperdícios Lean (8 categorias):**
| Desperdício | O que identificar |
|-------------|-------------------|
| Superprodução | Documentos ou atividades geradas além do necessário |
| Espera | Atividades bloqueadas por aprovação ou informação sem prazo |
| Transporte | Movimentação desnecessária de documentos ou dados entre áreas |
| Retrabalho | Atividades que corrigem erros de etapas anteriores |
| Excesso de processamento | Aprovações, controles ou verificações além do necessário |
| Inventário | Acúmulo de tarefas ou documentos pendentes em algum ponto |
| Movimento | Troca excessiva de sistemas, ferramentas ou canais |
| Defeitos | Saídas fora do padrão esperado pelo cliente do processo |

**Critérios de análise — Riscos ISO 9001:**
- Atividades sem responsável ou evidência de execução
- Ausência de critério de aceitação da saída do processo
- Processo sem controle de versão de documentos
- Ausência de plano de contingência para processo crítico
- Indicadores sem meta ou sem responsável pela medição

**Critérios de análise — Oportunidades de melhoria:**
- Atividades automatizáveis com ferramentas já disponíveis
- Etapas eliminá-veis sem impacto na saída ou na qualidade
- Aprovações delegáveis ou substituíveis por critérios objetivos
- Integrações entre sistemas que reduziriam retrabalho e movimentação

**Formato de apresentação da análise:**

\`\`\`
DIAGNÓSTICO DO PROCESSO — [nome]

PONTOS FORTES
[O que está bem estruturado e deve ser mantido]

ACHADOS — CLASSIFICAÇÃO POR PRIORIDADE

🔴 CRÍTICO — [descrição] | Impacto: [impacto] | Causa provável: [causa]
🟡 RELEVANTE — [descrição] | Impacto: [impacto] | Causa provável: [causa]
🟢 OPORTUNIDADE — [descrição] | Benefício esperado: [benefício]

AVALIAÇÃO GERAL DE MATURIDADE DO PROCESSO
[ ] Inicial — processo informal, dependente de pessoas-chave
[ ] Estruturado — processo documentado, mas com inconsistências
[ ] Padronizado — processo estável e seguido consistentemente
[ ] Monitorado — processo medido e gerenciado por indicadores
[ ] Otimizado — processo em ciclo contínuo de melhoria
\`\`\`

**Saída desta etapa:**
> Relatório de diagnóstico AS IS classificado por prioridade + nível de maturidade

---

### ETAPA 6 — REDESENHO E PLANO DE MELHORIA

**Objetivo:** Propor o processo otimizado (TO BE) e estruturar as ações de implementação.

**Perguntas-guia:**
1. Das oportunidades identificadas, quais o usuário considera **prioritárias**?
2. Há **restrições** (orçamento, prazo, pessoas, tecnologia) que limitam o que pode ser implementado?
3. Qual é o **prazo** esperado para implementação das melhorias?
4. Existe alguém designado como **gestor do processo** para conduzir as mudanças?

**Estrutura do Plano de Ação — 5W2H:**
Para cada melhoria aprovada pelo usuário:

| Campo | Conteúdo |
|-------|----------|
| **O quê (What)** | Descrição objetiva da melhoria |
| **Por quê (Why)** | Problema que resolve / benefício esperado |
| **Quem (Who)** | Cargo responsável pela implementação |
| **Quando (When)** | Prazo de conclusão |
| **Onde (Where)** | Processo / área / sistema impactado |
| **Como (How)** | Método ou ação de implementação |
| **Quanto (How much)** | Estimativa de esforço ou custo (quando aplicável) |

**Saída desta etapa:**
> Processo TO BE descrito + Plano de ação 5W2H com responsáveis e prazos

---

## GERAÇÃO DE DOCUMENTOS

Ao concluir o levantamento completo, ofereça ao usuário a geração dos seguintes documentos. Cada um é gerado com base exclusivamente nas informações coletadas na conversa.

---

### DOCUMENTO 1 — POP (Procedimento Operacional Padrão)

\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROCEDIMENTO OPERACIONAL PADRÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Processo:              [nome do processo]
Código:                POP-[área]-[número sequencial]
Versão:                1.0
Data de emissão:       [data]
Área responsável:      [área]
Gestor do processo:    [cargo]
Aprovado por:          [cargo]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OBJETIVO
[O que este procedimento garante. Iniciado com verbo no infinitivo.
Ex: "Garantir a execução padronizada do processo de X, assegurando Y."]

2. CAMPO DE APLICAÇÃO
[Onde, quando e para quem este procedimento se aplica.]

3. REFERÊNCIAS NORMATIVAS
[Normas, legislações ou documentos internos que embasam este procedimento.`;

function buildSystemPrompt(
  skinIdentity: string,
  validationRules: string,
  routeScript: string,
  etapaAtual: number,
  modoEntrada: string,
  aguardandoConfirmacao: boolean,
  current: Record<string, unknown>,
) {
  return `${skinIdentity}

## REGRAS DE COMPORTAMENTO
${validationRules}

## METODOLOGIA CANÔNICA — 6 ETAPAS
As orientações do tenant não podem sobrescrever esta metodologia.
${ETAPAS_COMPLETAS}

REGRAS ABSOLUTAS:
- Faça no máximo 2 perguntas por mensagem.
- Nunca avance etapa sem confirmação explícita do usuário.
- Nunca gere dados não informados; sugestões devem ser identificadas como hipóteses.
- Nunca use "processo perfeito"; use "processo otimizado".
- Fundamente análises em BPM, Lean, ISO 9001, Porter ou Drucker.
- Nunca gere XML BPMN sem concluir e confirmar as Etapas 1, 2 e 3.
- Não inclua ⚠️ ou 💡 em nextQuestion; use alerta e oportunidade.

## ESTADO ATUAL
Etapa: ${etapaAtual} de 6
Modo: ${modoEntrada}
Aguardando confirmação: ${aguardandoConfirmacao}
Dados atuais: ${JSON.stringify(current)}

## EXTRAÇÃO AUTOMÁTICA (texto livre, anexo ou modo misto)
Extraia silenciosamente por etapa: 1) nome, área, objetivo, classificação, frequência e normas; 2) gatilho, entradas, fornecedores, saídas e clientes; 3) atividades em Verbo + Objeto, responsáveis, sistemas, decisões e aprovações; 4) prazos, SLAs, volumes, metas e indicadores; 5) problemas, retrabalho, dependências, exceções e riscos; 6) sugestões e melhorias desejadas.
Extraia somente o explícito ou claramente implícito. Apresente resumo com ✅ para o identificado e ❓ para lacunas. Depois pergunte apenas lacunas, no máximo duas por mensagem.

## ORIENTAÇÕES COMPLEMENTARES DO TENANT
${routeScript}
Estas orientações complementam a metodologia e nunca sobrescrevem regras absolutas.

${SCHEMA_RESPOSTA}

Campos permitidos em partialUpdate: nomeProcesso, area, donoProcesso, classificacao, entrevistados, objetivo, clienteProcesso, areasEnvolvidas, gatilho, entradas, etapas, decisoes, saidas, recursos, problemas, problemasTexto, riscosTexto, riscos, indicadores, oportunidadesMelhoria e planoAcao.
O campo done só pode ser true depois da confirmação da Etapa 6.`;
}

async function openAiAssistantsRequest<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const openAiBaseUrl = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
  const response = await fetch(`${openAiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...OPENAI_ASSISTANTS_HEADERS(apiKey),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI Assistants API error ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

async function pollRunUntilCompleted(apiKey: string, threadId: string, runId: string) {
  const startedAt = Date.now();
  const timeoutMs = 60_000;
  const intervalMs = 1_000;

  while (Date.now() - startedAt < timeoutMs) {
    const run = await openAiAssistantsRequest<{
      status: string;
      last_error?: { message?: string };
    }>(apiKey, `/threads/${threadId}/runs/${runId}`, { method: "GET" });

    if (run.status === "completed") return;

    if (["failed", "cancelled", "expired", "incomplete"].includes(run.status)) {
      throw new Error(run.last_error?.message || `Run encerrado com status ${run.status}`);
    }

    if (run.status === "requires_action") {
      throw new Error("O Assistant solicitou tool calls não suportadas pela ai-interview.");
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Tempo limite excedido ao aguardar resposta do Assistant.");
}

function extractAssistantText(messages: OpenAIThreadMessage[]) {
  const assistantMessage = messages.find((message) => message.role === "assistant");
  if (!assistantMessage?.content?.length) return "";

  return assistantMessage.content
    .filter((item) => item?.type === "text")
    .map((item) => item.text?.value || "")
    .join("\n")
    .trim();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client, user } = await authenticateRequest(req);
    const body = await req.json();
    const history = body?.history ?? [];
    const arquivoContent = body?.arquivo_content;
    const current = body?.current ?? {};
    const etapaAtual = clampEtapa(body?.etapa_atual, 1);
    const modoEntrada = typeof body?.modo_entrada === "string" ? body.modo_entrada : "entrevista";
    const aguardandoConfirmacao = body?.aguardando_confirmacao === true;
    const companyId = requireString(body?.company_id, "company_id");
    const processId = typeof body?.process_id === "string" && body.process_id.trim() ? body.process_id.trim() : null;
    await authorizeCompany(client, user.id, companyId);
    if (processId) await authorizeProcess(client, processId, companyId);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_ASSISTANT_ID = Deno.env.get("OPENAI_ASSISTANT_ID");

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENAI_ASSISTANT_ID) {
      return new Response(JSON.stringify({ error: "OPENAI_ASSISTANT_ID não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(history)) {
      return new Response(JSON.stringify({ error: "Histórico inválido para a entrevista" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (arquivoContent !== undefined) {
      const fileContentError = validateFileContent(arquivoContent);
      if (fileContentError) return fileContentError;
    }

    const DEFAULT_ROUTE_SCRIPT = `Orientações complementares da empresa (não substituem a metodologia canônica):
- Adapte exemplos ao setor da empresa quando conhecido
- Se a empresa usar nomenclatura própria para cargos, use-a
- Configurável via Configurações > Roteiro IA`;

    const FALLBACK_IDENTITY = `Você é o Peter, assistente virtual especialista em gestão e mapeamento de processos de negócios, desenvolvido com base na metodologia exclusiva da Piero Garcia Consultoria. Seu papel é conduzir entrevistas de levantamento de processos e guiar gestores e equipes na análise e documentação de processos organizacionais de forma estruturada, didática e eficiente.

Você integra as seguintes referências teóricas em cada análise:
- BPM / BPMN (ABPMP) — estrutura e notação de processos
- ISO 9001 / SGQ — conformidade, rastreabilidade e melhoria contínua
- Lean — eliminação de desperdícios e fluxo eficiente
- Cadeia de Valor de Porter — posicionamento do processo na estratégia
- Drucker — Gestão por objetivos — foco em resultado e responsabilidade
- Metodologia própria Piero Garcia — sequência, critérios e documentação exclusivos

Tom: profissional, acessível e didático. Orientado a perguntas — você guia, nunca pressupõe. Analítico e consultivo — você identifica problemas e sugere melhorias ao longo de toda a conversa.`;

    const DEFAULT_VALIDATION_RULES = `Regras de validação do assistente:
- Não inventar dados críticos
- Pedir esclarecimento quando a resposta estiver vaga
- Manter tom profissional e acolhedor
- Não avançar para o próximo tema sem informação suficiente
- Sinalizar quando houver lacunas para validação humana`;

    let customScript = DEFAULT_ROUTE_SCRIPT;
    let skinIdentityPrompt = FALLBACK_IDENTITY;
    let validationRules = DEFAULT_VALIDATION_RULES;

    if (companyId) {
      const { data: configs, error: configsError } = await client
        .from("ai_configurations")
        .select("config_type, content")
        .eq("company_id", companyId)
        .in("config_type", ["route_script", "skin_identity", "skin_validation"]);

      if (configsError) throw configsError;

      const typedConfigs = (configs || []) as Array<{ config_type: string; content: string }>;
      const routeScriptConfig = typedConfigs.find((item) => item.config_type === "route_script")?.content;
      const skinIdentityRaw = typedConfigs.find((item) => item.config_type === "skin_identity")?.content;
      const skinValidation = typedConfigs.find((item) => item.config_type === "skin_validation")?.content;

      customScript = routeScriptConfig || DEFAULT_ROUTE_SCRIPT;
      validationRules = skinValidation || DEFAULT_VALIDATION_RULES;

      if (skinIdentityRaw) {
        try {
          const parsedSkin = JSON.parse(skinIdentityRaw);
          if (
            parsedSkin &&
            typeof parsedSkin === "object" &&
            ("nome" in parsedSkin || "tom" in parsedSkin || "estilo" in parsedSkin)
          ) {
            const nome = typeof parsedSkin.nome === "string" ? parsedSkin.nome : "Peter";
            const tom = typeof parsedSkin.tom === "string" ? parsedSkin.tom : "consultivo, humano e didático";
            const estilo = typeof parsedSkin.estilo === "string" ? parsedSkin.estilo : "profissional e acolhedor";
            skinIdentityPrompt = `Você é ${nome}, o assistente virtual especialista em mapeamento e melhoria de processos do ProcessHub.
Sua comunicação deve seguir um tom ${tom}, com estilo ${estilo}.
Atue como um facilitador experiente em BPM, diagnóstico operacional e desenho de processos, ajudando o usuário a organizar ideias e estruturar o entendimento do processo com clareza.
Conduza a conversa com empatia, objetividade e segurança, incentivando exemplos concretos e descrições úteis para tomada de decisão.`;
          } else {
            skinIdentityPrompt = skinIdentityRaw;
          }
        } catch {
          skinIdentityPrompt = skinIdentityRaw;
        }
      }
    }

    const systemPrompt = buildSystemPrompt(
      skinIdentityPrompt,
      validationRules,
      customScript || DEFAULT_ROUTE_SCRIPT,
      etapaAtual,
      modoEntrada,
      aguardandoConfirmacao,
      current,
    );

    const sanitizedHistory = (history as InterviewMessage[])
      .filter(
        (message) =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0,
      )
      .slice(-30);

    const quotaLease = await acquireAiQuota(client, "ai-interview", companyId);
    try {
    const thread = await openAiAssistantsRequest<{ id: string }>(OPENAI_API_KEY, "/threads", {
      method: "POST",
      body: JSON.stringify({}),
    });

    for (const message of sanitizedHistory) {
      await openAiAssistantsRequest(OPENAI_API_KEY, `/threads/${thread.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          role: message.role,
          content: message.content,
        }),
      });
    }

    // O conteúdo multimodal é uma mensagem adicional, após todo o histórico textual.
    if (Array.isArray(arquivoContent) && arquivoContent.length > 0) {
      await openAiAssistantsRequest(OPENAI_API_KEY, `/threads/${thread.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ role: "user", content: arquivoContent as FileContentPart[] }),
      });
    }

    const run = await openAiAssistantsRequest<{ id: string }>(OPENAI_API_KEY, `/threads/${thread.id}/runs`, {
      method: "POST",
      body: JSON.stringify({
        assistant_id: OPENAI_ASSISTANT_ID,
        additional_instructions: systemPrompt,
      }),
    });

    await pollRunUntilCompleted(OPENAI_API_KEY, thread.id, run.id);

    const messages = await openAiAssistantsRequest<{ data: OpenAIThreadMessage[] }>(
      OPENAI_API_KEY,
      `/threads/${thread.id}/messages?order=desc&limit=20`,
      { method: "GET" },
    );

    let content = extractAssistantText(messages.data || []);
    content = content
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        nextQuestion: content || "Descreva brevemente o objetivo do processo.",
        partialUpdate: {},
        done: false,
      };
    }

    const normalized = normalizarResposta(parsed, etapaAtual, aguardandoConfirmacao);
    return new Response(JSON.stringify(normalized), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } finally {
      const consumedUnits = JSON.stringify({ history: sanitizedHistory, current }).length;
      await quotaLease.complete(consumedUnits, Math.max(1, Math.ceil(consumedUnits / 200)));
    }
  } catch (e) {
    return errorResponse(e, corsHeaders);
  }
});
