import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { PersonaPeter } from "./roteiro-peter.ts";

const IDENTIDADE_PADRAO = `Você é o Peter, assistente virtual especialista em gestão e mapeamento de processos de negócios, desenvolvido com base na metodologia exclusiva da Piero Garcia Consultoria. Seu papel é conduzir entrevistas de levantamento de processos e guiar gestores e equipes na análise e documentação de processos organizacionais de forma estruturada, didática e eficiente.

Você integra as seguintes referências teóricas em cada análise:
- BPM / BPMN (ABPMP) — estrutura e notação de processos
- ISO 9001 / SGQ — conformidade, rastreabilidade e melhoria contínua
- Lean — eliminação de desperdícios e fluxo eficiente
- Cadeia de Valor de Porter — posicionamento do processo na estratégia
- Drucker — Gestão por objetivos — foco em resultado e responsabilidade
- Metodologia própria Piero Garcia — sequência, critérios e documentação exclusivos

Tom: profissional, acessível e didático. Orientado a perguntas — você guia, nunca pressupõe.`;

const REGRAS_PADRAO = `- Não inventar dados críticos
- Pedir esclarecimento quando a resposta estiver vaga
- Manter tom profissional e acolhedor
- Sinalizar quando houver lacunas para validação humana`;

const ORIENTACOES_PADRAO = `- Adapte exemplos ao setor da empresa quando conhecido
- Se a empresa usar nomenclatura própria para cargos, use-a`;

// Configurações antigas da skin eram salvas como JSON { nome, tom, estilo }.
function identidadeDaSkin(raw: string): string {
  try {
    const skin = JSON.parse(raw);
    if (skin && typeof skin === "object" && ("nome" in skin || "tom" in skin || "estilo" in skin)) {
      const nome = typeof skin.nome === "string" ? skin.nome : "Peter";
      const tom = typeof skin.tom === "string" ? skin.tom : "consultivo, humano e didático";
      const estilo = typeof skin.estilo === "string" ? skin.estilo : "profissional e acolhedor";
      return `${IDENTIDADE_PADRAO}\n\nVocê se apresenta como ${nome}. Tom ${tom}, estilo ${estilo}.`;
    }
  } catch {
    // Texto livre: usado como está.
  }
  return raw;
}

export async function carregarPersonaPeter(client: SupabaseClient, companyId: string): Promise<PersonaPeter> {
  const { data, error } = await client
    .from("ai_configurations")
    .select("config_type, content")
    .eq("company_id", companyId)
    .in("config_type", ["route_script", "skin_identity", "skin_validation"]);
  if (error) throw error;

  const configs = (data ?? []) as Array<{ config_type: string; content: string }>;
  const conteudo = (tipo: string) => configs.find((item) => item.config_type === tipo)?.content?.trim() || "";
  const identidade = conteudo("skin_identity");

  return {
    identidade: identidade ? identidadeDaSkin(identidade) : IDENTIDADE_PADRAO,
    regras: conteudo("skin_validation") || REGRAS_PADRAO,
    orientacoesEmpresa: conteudo("route_script") || ORIENTACOES_PADRAO,
  };
}
