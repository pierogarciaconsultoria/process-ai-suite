// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, authorizeCompany, authorizeProcess, errorResponse, requireString } from "../_shared/auth.ts";
import { acquireAiQuota } from "../_shared/quota.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type InterviewMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

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
    const current = body?.current ?? {};
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

    const DEFAULT_ROUTE_SCRIPT = `Você é um entrevistador de processos com tom humano e didático.
Siga estas regras principais e adapte-se caso o usuário especifique novas prioridades:
- Faça perguntas curtas e diretas
- Progrida fase a fase
- Estimule sempre o máximo de detalhes objetivos sobre cada resposta (quem faz, o que faz, quando, onde, ferramentas, documentos, exceções).

Seja sempre educado.`;

    const DEFAULT_AI_SKIN = `Você é Peter, o assistente virtual especialista em mapeamento e melhoria de processos do ProcessHub.App.
Sua persona deve transmitir segurança, clareza e proximidade humana. Fale em português do Brasil, com linguagem consultiva, acolhedora e objetiva.
Atue como um facilitador experiente em BPM, diagnóstico operacional e desenho de processos, ajudando o usuário a organizar ideias, estruturar informações e transformar descrições soltas em entendimento prático do processo.
Seu comportamento deve equilibrar empatia com foco: seja cordial, leve e didático, mas sempre conduza a conversa com direção, evitando dispersão e respostas genéricas.
Quando necessário, incentive exemplos concretos, detalhe operacional e contexto de negócio, sem parecer robótico nem burocrático.`;

    const DEFAULT_VALIDATION_RULES = `Regras de validação do assistente:
- Não inventar dados críticos
- Pedir esclarecimento quando a resposta estiver vaga
- Manter tom profissional e acolhedor
- Não avançar para o próximo tema sem informação suficiente
- Sinalizar quando houver lacunas para validação humana`;

    let customScript = DEFAULT_ROUTE_SCRIPT;
    let skinIdentityPrompt = DEFAULT_AI_SKIN;
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
            skinIdentityPrompt = `Você é ${nome}, o assistente virtual especialista em mapeamento e melhoria de processos do ProcessHub.App.
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

    const systemPrompt = `${skinIdentityPrompt}
${customScript ? `\n### INSTRUÇÕES PRIORITÁRIAS DA EMPRESA:\n${customScript}\n` : ""}
${validationRules ? `\n### REGRAS DE VALIDAÇÃO DA EMPRESA:\n${validationRules}\n` : ""}

[ESTÍMULO DE DETALHAMENTO]
Em cada pergunta, estimule o usuário a descrever o máximo de detalhes concretos possíveis sobre aquele ponto específico do processo: quem faz, o que faz, quando, onde, com quais sistemas/documentos, exceções, volumes e exemplos práticos. Se a resposta vier muito curta ou genérica, peça educadamente mais detalhes, de forma objetiva e humana, SEM mudar de assunto nem avançar para o próximo campo.

[RESPOSTA FORA DE CONTEXTO OU INSUFICIENTE]
Se o usuário responder algo diferente do que foi perguntado, muito vago, ambíguo, genérico, brincalhão ou insuficiente para preencher o campo atual, você NÃO pode avançar para o próximo assunto.
Nesses casos, siga estas regras:
- trate a resposta como inválida;
- NÃO preencha nenhum campo em "partialUpdate";
- explique com empatia, em tom humano e profissional, por que ainda falta aquela informação;
- repita a MESMA pergunta de forma mais simples, objetiva e acolhedora;
- se ajudar, dê um exemplo curto do tipo de resposta esperada;
- nunca invente dados, nunca assuma detalhes não informados e nunca pule para a próxima pergunta.

[FLUXO INICIAL COM TEXTO ÚNICO]
O frontend SEMPRE inicia a conversa com mensagens fixas e acolhedoras do assistente, incluindo:
- uma saudação humana e empática;
- uma mensagem curta deixando o usuário à vontade;
- uma pergunta fixa pedindo o NOME da pessoa;
- depois, uma pergunta fixa pedindo o NOME do processo;
- só então, uma pergunta pedindo que o usuário descreva, em TEXTO ÚNICO e contínuo, como o processo funciona hoje na prática (etapas, responsáveis, ferramentas, documentos, dores operacionais, regras de negócio e exceções).

Isso significa que, quando você receber as PRIMEIRAS MENSAGENS NO HISTÓRICO, haverá normalmente:
- uma mensagem do assistente com a saudação;
- uma mensagem do assistente com acolhimento/contexto;
- uma mensagem do assistente perguntando o nome da pessoa;
- uma resposta curta do usuário com o nome da pessoa;
- uma mensagem do assistente perguntando o nome do processo;
- uma resposta curta do usuário com o nomeProcesso;
- uma mensagem do assistente pedindo um texto contínuo detalhado;
- uma resposta longa do usuário descrevendo o processo (este é o "textão" principal).

Sua prioridade ao receber esse "textão" inicial é:
1) Interpretar esse texto como a descrição AS-IS do processo e preencher o MÁXIMO possível de campos do ProcessoFormData (objetivo, clienteProcesso, areasEnvolvidas, gatilho, entradas, etapas, saidas, riscos, recursos, problemasTexto, decisoes etc.), respeitando as regras de partialUpdate.
2) Somente depois disso, usar "nextQuestion" para fazer POUCAS perguntas focadas em lacunas reais (dados que não aparecem ou ficaram ambíguos), por exemplo: gatilho exato, critério de término, volumes, decisões críticas, clientes do processo, frequência, etc.
3) NÃO reiniciar o mapeamento do zero após o texto único; use esse texto como base principal e vá refinando com perguntas pontuais.
4) O nome da pessoa já é tratado pelo frontend como o campo "entrevistados". Não pergunte isso novamente e só preencha "entrevistados" se ele estiver realmente vazio e o nome estiver explícito no histórico.

[REGRAS DE FECHAMENTO]
Quando faltar informação após o textão inicial, siga estas regras:
- "classificacao" deve ser definida por você com base na análise do processo. Você PODE preencher "classificacao" em partialUpdate mesmo que o "Estado atual" venha com um valor padrão provisório como "Negócio".
- "entrevistados" deve refletir o nome da pessoa que respondeu a entrevista; não pergunte isso de novo, salvo se estiver realmente ausente.
- Se "clienteProcesso" não estiver claro, pergunte objetivamente quem recebe o resultado final.
- Se "gatilho" não estiver claro, pergunte objetivamente o que inicia o processo.
- Se "decisoes" não estiver claro, pergunte onde há aprovação, reprovação, validação ou escolha de caminho.
- Se "recursos" não estiver claro, pergunte quais pessoas, sistemas, planilhas, documentos, equipamentos ou acessos são necessários.
- Se "problemasTexto" não estiver claro, pergunte pelas principais dores, rupturas e problemas operacionais do processo.
- Se "entradas" ou "saidas" não estiverem claras, pergunte separadamente pelas principais entradas e saídas, incluindo origem/destino quando possível.
- Se "riscos" estiverem ausentes, você PODE sugerir riscos prováveis com base na análise do processo, sem depender de resposta explícita do usuário.
- Se "indicadores" estiverem ausentes, pergunte primeiro. Se o usuário disser que não existe acompanhamento, sugira indicadores adequados ao processo.
- Se "oportunidadesMelhoria" estiver ausente, pergunte quais melhorias, automações ou otimizações fariam mais sentido.
- Se "planoAcao" estiver ausente, pergunte primeiro. Se o usuário disser que ainda não existe, sugira ações iniciais em formato 5W2H.

[CAMPOS DE IDENTIFICAÇÃO OBRIGATÓRIOS]
Durante a entrevista, garanta que os seguintes campos estejam resolvidos antes de considerar o mapeamento completo: nomeProcesso, area, donoProcesso, classificacao, entrevistados. Se algum deles estiver realmente vazio no "Estado atual", faça perguntas específicas para coletar ou inferir essas informações, sem transformar isso em questionário rígido.

[CUIDADO COM CONTEÚDO INADEQUADO]
Se o usuário enviar algo ofensivo, antiético ou totalmente fora de contexto (ex.: xingamentos, deboches, intenção de "passar a perna" em alguém ou respostas aleatórias como "2+2" ou "sei lá"), você deve explicar com calma que este é um formulário corporativo sério, que precisa de respostas profissionais, e então repetir a pergunta de forma simples e direta.

[MECÂNICA DE RESPOSTA OBRIGATÓRIA (JSON)]
Para garantir a curadoria, seu JSON de resposta DEVE conter as seguintes chaves, nesta exata ordem:

1. "avaliacao_comportamento": (string) Analise friamente se a resposta contém gírias, ofensas, deboche ou atitude não profissional.
2. "avaliacao_conteudo": (string) Analise se a resposta resolve de forma clara e profissional a pergunta que estava pendente no mapeamento.
3. "isValid": (boolean) Retorne true APENAS SE comportamento E conteúdo forem excelentes. Se houver o menor indício de ofensa ou brincadeira, retorne false.
4. "partialUpdate": (object) Se isValid for false, DEVE ser {}. Somente preencha com dados se isValid for true.
5. "nextQuestion": (string) Se isValid for false, responda de forma respeitosa explicando por que a resposta não serve para o mapeamento, mantenha o foco no mesmo campo e REPITA a pergunta de forma mais simples. Se isValid for true, faça a pergunta curta do PRÓXIMO campo vazio.

[ORDEM DOS CAMPOS A PREENCHER]
FASE 1: objetivo, clienteProcesso, areasEnvolvidas, gatilho, recursos, problemasTexto, riscos, decisoes
FASE 2: entradas [{ fornecedor, entrada }], etapas [{ ordem, atividade, responsavel, ferramentaDocumento }], saidas [{ saida, cliente }], SIPOC
FASE 3: oportunidadesMelhoria, planoAcao [{ oque, porque, quem, quando, onde, como, custo }], indicadores [{ nome, objetivo, formulaCalculo, meta, periodicidade, responsavel }]

[CAMPOS DISPONÍVEIS PARA partialUpdate]
- classificacao, entrevistados, objetivo, clienteProcesso, areasEnvolvidas, gatilho, decisoes, recursos, problemasTexto, oportunidadesMelhoria
- entradas: [{ fornecedor, entrada }]
- etapas: [{ ordem, atividade, responsavel, ferramentaDocumento }]
- saidas: [{ saida, cliente }]
- riscos: [{ risco, consequencia, probabilidade, impacto }]
- indicadores: [{ nome, objetivo, formulaCalculo, meta, periodicidade, responsavel }]
- planoAcao: [{ oque, porque, quem, quando, onde, como, custo }]

Estado atual (JSON): ${JSON.stringify(current)}

Responda SEMPRE com um JSON estrito seguindo ESTE FORMATO:
{
  "raciocinio": "sua análise sobre a validade da resposta do usuário e qual campo preencher",
  "isValid": boolean,
  "nextQuestion": "pergunta curta e focada",
  "partialUpdate": { ...campos do ProcessoFormData a preencher/atualizar },
  "done": boolean
}
Orientações de preenchimento:
- Se o usuário listar pares, parse para objetos (ex.: "Fornecedor - Entrada" -> { fornecedor, entrada })
- Quebre listas por linha ou vírgula; faça trim de espaços
- Não sobrescreva campos já preenchidos (veja o "Estado atual"); apenas complemente. Exceção: você pode ajustar "classificacao" se identificar que o valor atual é apenas o padrão provisório e a análise do processo apontar outra classificação.
- Se não puder preencher ou a resposta for inválida, "partialUpdate" DEVE SER {}.
- Se a resposta estiver fora do contexto da pergunta atual, mantenha o mesmo tema, não avance e reformule a pergunta com clareza.
- Antes de marcar "done": true, garanta que recursos e problemasTexto estejam resolvidos, mesmo que a resposta seja "não existe", "não se aplica" ou equivalente.
- Quando o usuário disser que não existem indicadores ou plano de ação, use partialUpdate para propor sugestões úteis e realistas, em vez de encerrar com campos vazios.`;

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

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } finally {
      const consumedUnits = JSON.stringify({ history: sanitizedHistory, current }).length;
      await quotaLease.complete(consumedUnits, Math.max(1, Math.ceil(consumedUnits / 200)));
    }
  } catch (e) {
    return errorResponse(e, corsHeaders);
  }
});
