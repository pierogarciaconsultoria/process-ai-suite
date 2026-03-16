type Etapa = { ordem: number; atividade: string; responsavel: string; sistema: string };
type Risco = { risco: string; impacto: string };

export type AIProcessOutput = {
  entradas: string;
  etapas: Etapa[];
  decisoes: string;
  saidas: string;
  problemas: { retrabalho: boolean; atrasos: boolean; erros: boolean; dependencia: boolean };
  problemasTexto: string;
  riscos: Risco[];
  indicadores: string;
  sugestoes: string;
};

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

export async function aiFillFromObjective(objective: string): Promise<AIProcessOutput> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  }

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Você é um analista de processos. Gere um plano conciso e prático. Responda estritamente em JSON com as chaves: entradas, etapas[{ordem,atividade,responsavel,sistema}], decisoes, saidas, problemas{retrabalho,atrasos,erros,dependencia}, problemasTexto, riscos[{risco,impacto}], indicadores, sugestoes.",
      },
      {
        role: "user",
        content:
          `Objetivo do processo: ${objective}\nPreencha todas as chaves. Limite etapas a 4-7 itens. Use linguagem objetiva.`,
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "OPENAI_REQUEST_FAILED");
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(extractJson(content)) as Partial<AIProcessOutput>;

  const etapas: Etapa[] = Array.isArray(parsed.etapas)
    ? parsed.etapas.map((e, i: number) => ({
        ordem: Number(e?.ordem ?? i + 1),
        atividade: String(e?.atividade ?? ""),
        responsavel: String(e?.responsavel ?? ""),
        sistema: String(e?.sistema ?? ""),
      }))
    : [];

  const riscos: Risco[] = Array.isArray(parsed.riscos)
    ? parsed.riscos.map((r) => ({
        risco: String(r?.risco ?? ""),
        impacto: String(r?.impacto ?? ""),
      }))
    : [];

  return {
    entradas: String(parsed.entradas ?? ""),
    etapas,
    decisoes: String(parsed.decisoes ?? ""),
    saidas: String(parsed.saidas ?? ""),
    problemas: {
      retrabalho: !!parsed?.problemas?.retrabalho,
      atrasos: !!parsed?.problemas?.atrasos,
      erros: !!parsed?.problemas?.erros,
      dependencia: !!parsed?.problemas?.dependencia,
    },
    problemasTexto: String(parsed.problemasTexto ?? ""),
    riscos,
    indicadores: String(parsed.indicadores ?? ""),
    sugestoes: String(parsed.sugestoes ?? ""),
  };
}
