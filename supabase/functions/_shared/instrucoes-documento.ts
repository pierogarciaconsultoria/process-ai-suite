// Instruções configuradas no modelo de documento (Configurações → Documentação do Processo).
// O prompt, as instruções de geração e o texto de referência viram instruções de verdade
// para a IA, e não apenas dados do pedido. É por aqui que entram, por exemplo, as instruções
// de um GPT ou de uma skill que a empresa já usa para escrever procedimentos.

export const MAX_INSTRUCOES = 20_000;
export const MAX_REFERENCIA = 30_000;

export const REGRAS_QUE_PREVALECEM = `## REGRAS QUE PREVALECEM SOBRE AS INSTRUÇÕES DO MODELO
- Use somente os dados do processo fornecidos; nunca invente responsáveis, prazos, sistemas, métricas ou normas. O que faltar, escreva [não informado].
- O material de referência ensina estrutura, estilo e padrões; não copie dele dados de outro processo.
- Responda no formato JSON definido abaixo, com o documento em markdown no campo content_markdown.`;

type Registro = Record<string, unknown>;

function registro(valor: unknown): Registro {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Registro) : {};
}

function texto(valor: unknown, limite: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

export function instrucoesDoModelo(template: unknown, generationConfig: unknown): string {
  const modelo = registro(template);
  // Documentos e a configuração mandam o promptConfig em generationConfig; o template também o traz.
  const config = { ...registro(modelo.promptConfig), ...registro(generationConfig) };

  const prompt = texto(config.systemPrompt, MAX_INSTRUCOES);
  const geracao = texto(config.generationInstructions, MAX_INSTRUCOES);
  const estilo = [
    texto(config.tone, 100) && `Tom: ${texto(config.tone, 100)}.`,
    texto(config.detailLevel, 100) && `Nível de detalhamento: ${texto(config.detailLevel, 100)}.`,
    texto(config.targetAudience, 300) && `Público-alvo: ${texto(config.targetAudience, 300)}.`,
  ].filter(Boolean).join(" ");
  const referencia = texto(modelo.referenceContent, MAX_REFERENCIA);

  const blocos = [
    prompt || geracao || estilo
      ? [`## INSTRUÇÕES DO MODELO "${texto(modelo.name, 200) || "sem nome"}" (configuradas pela empresa)`, prompt, geracao, estilo].filter(Boolean).join("\n\n")
      : "",
    referencia ? `## MATERIAL DE REFERÊNCIA DO MODELO\n${referencia}` : "",
  ].filter(Boolean);

  return blocos.length > 0 ? [...blocos, REGRAS_QUE_PREVALECEM].join("\n\n") : "";
}

// Dados do pedido sem as instruções, que já foram para o prompt de sistema.
export function modeloSemInstrucoes(template: unknown): Registro {
  const { promptConfig: _prompt, referenceContent: _referencia, ...resto } = registro(template);
  return resto;
}
