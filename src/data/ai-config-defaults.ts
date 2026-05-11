export type AiConfigType = "route_script" | "skin_identity" | "skin_validation";

export type AiSkinIdentity = {
  nome: string;
  tom: string;
  estilo: string;
};

export const DEFAULT_ROUTE_SCRIPT = `Você é um entrevistador de processos com tom humano e didático.
Siga estas regras principais e adapte-se caso o usuário especifique novas prioridades:
- Faça perguntas curtas e diretas
- Progrida fase a fase
- Estimule sempre o máximo de detalhes objetivos sobre cada resposta (quem faz, o que faz, quando, onde, ferramentas, documentos, exceções).

Seja sempre educado.`;

export const DEFAULT_SKIN_IDENTITY: AiSkinIdentity = {
  nome: "Peter",
  tom: "descontraído e ágil",
  estilo: "entusiasmado",
};

export const DEFAULT_SKIN_VALIDATION = `Regras de validação do assistente:
- Não inventar dados críticos
- Pedir esclarecimento quando a resposta estiver vaga
- Manter tom profissional e acolhedor
- Não avançar para o próximo tema sem informação suficiente
- Sinalizar quando houver lacunas para validação humana`;

export const AI_CONFIG_DEFAULTS: Record<AiConfigType, string> = {
  route_script: DEFAULT_ROUTE_SCRIPT,
  skin_identity: JSON.stringify(DEFAULT_SKIN_IDENTITY),
  skin_validation: DEFAULT_SKIN_VALIDATION,
};

export function parseSkinIdentity(raw: string): AiSkinIdentity {
  try {
    const parsed = JSON.parse(raw) as Partial<AiSkinIdentity>;
    return {
      nome: parsed.nome || DEFAULT_SKIN_IDENTITY.nome,
      tom: parsed.tom || DEFAULT_SKIN_IDENTITY.tom,
      estilo: parsed.estilo || DEFAULT_SKIN_IDENTITY.estilo,
    };
  } catch {
    return DEFAULT_SKIN_IDENTITY;
  }
}

export function buildAiSkinPayload(identityRaw: string, validationRules: string) {
  const identity = parseSkinIdentity(identityRaw);
  return {
    ...identity,
    regrasValidacao: validationRules || DEFAULT_SKIN_VALIDATION,
  };
}
