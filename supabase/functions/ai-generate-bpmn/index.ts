import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    } = await req.json();

    const hasEtapas = Array.isArray(etapas) && etapas.length > 0;
    const hasResumo = typeof resumo === "string" && resumo.trim().length > 0;

    if (!hasEtapas && !hasResumo) {
      return new Response(
        JSON.stringify({ error: "Preencha pelo menos uma atividade ou um resumo textual antes de gerar o mapa." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      : `Este é o mapa AS-IS (situação atual). Represente fielmente o processo como descrito.`;

    const systemPrompt = `Você é um especialista em modelagem BPMN 2.0. Gere XML BPMN 2.0 válido e completo.

REGRAS OBRIGATÓRIAS:
1. Use namespaces corretos: bpmn, bpmndi, dc, di
2. Inclua StartEvent, EndEvent, e Tasks para cada atividade
3. Se houver decisões, use ExclusiveGateway com fluxos divergentes e convergentes
4. Conecte tudo com SequenceFlow
5. OBRIGATÓRIO: Inclua o BPMNDiagram com BPMNShape e BPMNEdge com coordenadas (waypoints) para layout horizontal legível
6. Posicione elementos da esquerda para direita, com espaçamento de ~150px entre elementos
7. StartEvent em x=180, primeiro task em x=330, e assim por diante
8. Tasks com width=100, height=80. Events com width=36, height=36. Gateways com width=50, height=50.
9. Y base = 160 para o fluxo principal
10. NÃO inclua \`\`\`xml ou qualquer markdown. Retorne APENAS o XML puro.

${modeInstruction}`;

    const userPrompt = `Processo: ${nomeProcesso || "Sem nome"}
Gatilho: ${gatilho || "N/A"}
Entradas: ${entradasText}
Decisões: ${decisoes || "Nenhuma"}
Saídas: ${saidasText}

Resumo textual (se fornecido):
${hasResumo ? resumo : "N/A"}

Atividades:
${etapasText}

Gere o XML BPMN 2.0 completo com diagrama visual (BPMNDiagram).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
    let content = json.choices?.[0]?.message?.content || "";

    // Clean up any markdown fences the model may have added
    content = content.replace(/```xml\s*/gi, "").replace(/```\s*/g, "").trim();

    // Validate it looks like BPMN XML
    if (!content.includes("<bpmn:definitions") && !content.includes("<definitions")) {
      console.error("Generated content is not valid BPMN:", content.substring(0, 200));
      return new Response(
        JSON.stringify({ error: "A IA não gerou um XML BPMN válido. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ xml: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-generate-bpmn error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
