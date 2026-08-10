import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, authorizeCompany, authorizeProcess, errorResponse, requireString } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildFallbackMarkdown(templateName: string, sections: { sectionTitle: string; sectionDescription?: string }[], context: Record<string, unknown>) {
  const body = sections
    .map((section) => {
      const contextKey = section.sectionTitle.toLowerCase();
      const contextValue = Object.entries(context).find(([key]) => key.toLowerCase().includes(contextKey))?.[1];
      const content =
        typeof contextValue === "string" && contextValue.trim()
          ? contextValue
          : section.sectionDescription || "Não informado.";
      return `## ${section.sectionTitle}\n\n${content}`;
    })
    .join("\n\n");

  return `# ${templateName}\n\n${body}`.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client, user } = await authenticateRequest(req);
    const body = await req.json();
    const {
      template,
      sections = [],
      mappedProcessData = null,
      manualDescription = null,
      generationConfig = null,
      companyContext = null,
      process_id = null,
    } = body ?? {};
    const companyId = requireString(companyContext?.companyId, "company_id");
    await authorizeCompany(client, user.id, companyId);
    if (mappedProcessData) {
      const processId = requireString(process_id, "process_id");
      await authorizeProcess(client, processId, companyId);
    }

    if (!template) {
      return new Response(
        JSON.stringify({ error: "Template é obrigatório para gerar o documento." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    const contextPayload = {
      template,
      sections,
      generationConfig,
      companyContext,
      mappedProcessData,
      manualDescription,
    };

    if (!OPENAI_API_KEY) {
      const contentMarkdown = buildFallbackMarkdown(
        template.name ?? "Documento gerado",
        sections,
        manualDescription || mappedProcessData?.normalized || {},
      );

      return new Response(
        JSON.stringify({
          title: manualDescription?.title || template.name || "Documento gerado",
          content_markdown: contentMarkdown,
          content_text: contentMarkdown.replace(/[#*`>-]/g, "").trim(),
          executive_summary: "Documento gerado em modo fallback, sem chamada externa de IA.",
          attention_points: ["Configurar OPENAI_API_KEY para geração avançada."],
          suggested_risks: [],
          suggested_indicators: [],
          generation_metadata: {
            mode: "fallback",
            template_id: template.id ?? null,
            sections_count: Array.isArray(sections) ? sections.length : 0,
          },
          ai_model: "fallback-local",
          ai_prompt_used: "fallback-local",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `Você é um consultor sênior especialista em gestão documental, BPM, padronização operacional, melhoria contínua e documentação corporativa.

Sua tarefa é gerar documentos de processos para um SaaS B2B chamado ProcessHub.App.

Regras obrigatórias:
- Use somente os dados fornecidos.
- Não invente dados críticos.
- Quando faltar informação relevante, registre "não informado" ou sugira validação.
- Respeite o modelo documental selecionado.
- Escreva em português do Brasil.
- Gere conteúdo profissional, claro e aplicável.
- O documento deve ser retornado em markdown estruturado.

Você deve responder SEMPRE em JSON com as chaves:
- title
- content_markdown
- content_text
- executive_summary
- attention_points
- suggested_risks
- suggested_indicators
- generation_metadata
- ai_prompt_used`;

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: JSON.stringify(contextPayload),
            },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return new Response(
        JSON.stringify({ error: `AI error ${response.status}: ${text}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || "{}";

    return new Response(content, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return errorResponse(e, corsHeaders);
  }
});
