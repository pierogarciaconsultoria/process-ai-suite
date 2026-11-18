import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, authorizeCompany, authorizeProcess, errorResponse, requireString } from "../_shared/auth.ts";
import { acquireAiQuota, fetchWithAiQuota } from "../_shared/quota.ts";
import { runConfiguredAssistant, stripCodeFence } from "../_shared/openai-assistant.ts";
import {
  type EstruturaBpmn,
  estruturaLinear,
  montarBpmnXml,
  normalizarEstrutura,
  totalDeTarefas,
} from "../_shared/bpmn-montagem.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function validarDadosParaBPMN(body: Record<string, unknown>): string[] {
  const erros: string[] = [];
  if (!String(body.nomeProcesso || "").trim()) erros.push("Nome do processo não informado (Etapa 1)");
  if (!String(body.gatilho || "").trim()) erros.push("Gatilho de início não informado (Etapa 2)");
  const saidas = body.saidas;
  if (!Array.isArray(saidas) || !saidas.some((item) => item && typeof item === "object" && String((item as Record<string, unknown>).saida || "").trim())) {
    erros.push("Saída principal não informada (Etapa 2)");
  }
  const etapas = body.etapas;
  if (!Array.isArray(etapas) || etapas.length === 0) {
    erros.push("Nenhuma atividade mapeada (Etapa 3)");
  } else {
    const semResponsavel = etapas.filter((item) => !item || typeof item !== "object" || !String((item as Record<string, unknown>).responsavel || "").trim());
    if (semResponsavel.length) erros.push(`${semResponsavel.length} atividade(s) sem responsável (Etapa 3)`);
  }
  return erros;
}

export function validarXMLBPMN(xml: string): { valido: boolean; problemas: string[] } {
  const problemas: string[] = [];
  if (!xml.includes("startEvent")) problemas.push("Ausente: startEvent");
  if (!xml.includes("endEvent")) problemas.push("Ausente: endEvent");
  if (!xml.includes("sequenceFlow")) problemas.push("Ausente: sequenceFlow");
  if (!xml.includes("BPMNDiagram")) problemas.push("Ausente: BPMNDiagram (sem layout visual)");
  if (!xml.includes("BPMNShape")) problemas.push("Ausente: BPMNShape (sem coordenadas)");
  const ids = [...xml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicados = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicados.length) problemas.push(`IDs duplicados: ${duplicados.join(", ")}`);
  return { valido: problemas.length === 0, problemas };
}

// A IA devolve só a estrutura; o XML e o layout são montados em bpmn-montagem.ts.
const FORMATO_ESTRUTURA = `Responda APENAS com um JSON, sem markdown, neste formato:
{
  "raias": ["Papel A", "Papel B"],
  "nos": [
    { "id": "inicio", "tipo": "inicio", "nome": "Evento que dispara o processo", "raia": "Papel A" },
    { "id": "t1", "tipo": "tarefa", "nome": "Verbo + objeto", "raia": "Papel A", "sistema": "Sistema ou documento usado" },
    { "id": "d1", "tipo": "decisao", "nome": "Pergunta da decisão?", "raia": "Papel B" },
    { "id": "fim", "tipo": "fim", "nome": "Resultado final", "raia": "Papel B" }
  ],
  "fluxos": [ { "de": "inicio", "para": "t1" }, { "de": "d1", "para": "t2", "rotulo": "Sim" } ]
}
REGRAS:
- Uma raia por papel (cargo) responsável. Quando a atividade lista vários responsáveis, use o papel principal e repita as raias já criadas; não crie raia com vários nomes juntos.
- "tipo" é um de: inicio, fim, tarefa, decisao. Um "inicio" para cada gatilho diferente e pelo menos um "fim".
- Toda decisão tem pelo menos dois fluxos de saída, cada um com "rotulo" (ex.: Sim / Não, ou o critério).
- Tarefas em [Verbo de ação] + [Objeto]. "sistema" só quando a atividade usa um sistema, ferramenta ou documento.
- Todos os nós ligados por fluxos, do início ao fim.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client, user } = await authenticateRequest(req);
    const body = await req.json();
    const {
      etapas,
      decisoes,
      gatilho,
      entradas,
      saidas,
      nomeProcesso,
      mode,
      oportunidadesMelhoria,
      resumo,
      company_id,
      process_id,
      use_peter_assistant,
    } = body;
    const companyId = requireString(company_id, "company_id");
    await authorizeCompany(client, user.id, companyId);
    if (typeof process_id === "string" && process_id.trim()) {
      await authorizeProcess(client, process_id.trim(), companyId);
    }

    const errosValidacao = validarDadosParaBPMN(body as Record<string, unknown>);
    if (errosValidacao.length > 0) {
      return new Response(JSON.stringify({
        error: "Dados insuficientes para gerar o BPMN.",
        detalhes: errosValidacao,
        instrucao: "Conclua e confirme as Etapas 1, 2 e 3 da entrevista.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const hasEtapas = Array.isArray(etapas) && etapas.length > 0;
    const hasResumo = typeof resumo === "string" && resumo.trim().length > 0;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const etapasText = hasEtapas
      ? etapas
          .map(
            (e: any, i: number) =>
              `${i + 1}. ${e.atividade} (Responsável: ${e.responsavel || "N/A"}, Ferramenta: ${
                e.ferramentaDocumento || "N/A"
              })`
          )
          .join("\n")
      : "Nenhuma atividade estruturada informada.";

    const entradasText = entradas?.map((e: any) => `${e.fornecedor} → ${e.entrada}`).join(", ") || "N/A";
    const saidasText = saidas?.map((s: any) => `${s.saida} → ${s.cliente}`).join(", ") || "N/A";

    const modeInstruction = mode === "to-be"
      ? `Este é o mapa TO-BE (futuro/otimizado). Incorpore as seguintes oportunidades de melhoria:\n- Oportunidades priorizadas: ${oportunidadesMelhoria || "N/A"}\nAdicione atividades otimizadas, remova gargalos e inclua automações quando fizer sentido.`
      : `Este é o mapa AS-IS (situação atual). Represente fielmente o processo como descrito: TODAS as atividades listadas viram uma tarefa cada, sem juntar nem omitir nenhuma.`;

    const systemPrompt = `Você é um especialista em modelagem BPMN 2.0. Descreva a estrutura do processo para o diagrama.

${modeInstruction}

${FORMATO_ESTRUTURA}`;

    const fimPadrao = String(saidas?.find((s: any) => String(s?.saida || "").trim())?.saida || "Fim");
    const xmlDaResposta = (conteudo: string): string => {
      let estrutura: EstruturaBpmn | null = null;
      try {
        estrutura = normalizarEstrutura(JSON.parse(stripCodeFence(conteudo)));
      } catch {
        estrutura = null;
      }
      // No AS IS nenhuma atividade da entrevista pode sumir; se sumiu, desenha o fluxo direto delas.
      const faltaAtividade = mode !== "to-be" && hasEtapas && estrutura !== null && totalDeTarefas(estrutura) < etapas.length;
      if (!estrutura || faltaAtividade) {
        console.warn("[ai-generate-bpmn] estrutura da IA inválida ou incompleta; usando fluxo linear das atividades");
        estrutura = estruturaLinear(etapas, String(gatilho || ""), fimPadrao);
      }
      return montarBpmnXml(estrutura, String(nomeProcesso || ""));
    };

    const userPrompt = `Processo: ${nomeProcesso || "Sem nome"}
Gatilho: ${gatilho || "N/A"}
Entradas: ${entradasText}
Decisões: ${decisoes || "Nenhuma"}
Saídas: ${saidasText}

Resumo textual (se fornecido):
${hasResumo ? resumo : "N/A"}

Atividades:
${etapasText}

Devolva o JSON da estrutura.`;

    if (use_peter_assistant === true) {
      const lease = await acquireAiQuota(client, "ai-generate-bpmn", companyId);
      try {
        const content = xmlDaResposta(await runConfiguredAssistant(OPENAI_API_KEY, systemPrompt, userPrompt));
        const validation = validarXMLBPMN(content);
        if (!validation.valido) throw new Error(`O Peter não retornou um XML BPMN válido: ${validation.problemas.join("; ")}`);
        return new Response(JSON.stringify({ xml: content }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } finally {
        await lease.complete(userPrompt.length, Math.max(1, Math.ceil(userPrompt.length / 200)));
      }
    }

    const openAiBaseUrl = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
    const response = await fetchWithAiQuota(client, "ai-generate-bpmn", companyId, userPrompt.length, `${openAiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar BPMN com IA. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const json = await response.json();
    const content = xmlDaResposta(json.choices?.[0]?.message?.content || "");

    // Validate it looks like BPMN XML
    const xmlValidation = validarXMLBPMN(content);
    if (!xmlValidation.valido) {
      console.error("Generated content is not valid BPMN:", content.substring(0, 200));
      return new Response(
        JSON.stringify({ error: "A IA não gerou um XML BPMN válido. Tente novamente.", detalhes: xmlValidation.problemas }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ xml: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-generate-bpmn error:", e);
    return errorResponse(e, corsHeaders);
  }
});
