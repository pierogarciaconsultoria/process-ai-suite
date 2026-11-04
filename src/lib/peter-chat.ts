import type { Json, Tables } from "@/integrations/supabase/types";
import type { Atalho, TipoAtalho } from "../../supabase/functions/_shared/peter-chat";

// Chat da tela inicial com o Peter (função ai-peter-chat, migration 202611040003).

export type Conversa = Pick<Tables<"peter_conversas">, "id" | "titulo" | "updated_at">;
export type MensagemChat = Pick<Tables<"peter_mensagens">, "id" | "role" | "conteudo" | "extras" | "created_at">;

export const SUGESTOES = [
  "Quais ações do Plano de Ação estão atrasadas?",
  "Quais indicadores estão fora da meta?",
  "Quais processos já foram mapeados?",
  "O que a ISO 9001 pede para controlar documentos?",
];

const TIPOS: TipoAtalho[] = ["processo", "documento", "acao", "indicador", "plano_de_acao", "indicadores", "processos", "documentos"];

export function lerExtras(extras: Json | null | undefined): { atalhos: Atalho[]; convite: { nomeProcesso: string } | null } {
  const dados = extras && typeof extras === "object" && !Array.isArray(extras) ? (extras as Record<string, unknown>) : {};
  const atalhos = (Array.isArray(dados.atalhos) ? dados.atalhos : []).flatMap((item) => {
    const atalho = item as Partial<Atalho> | null;
    return atalho && TIPOS.includes(atalho.tipo as TipoAtalho) && typeof atalho.rotulo === "string"
      ? [{ tipo: atalho.tipo as TipoAtalho, id: typeof atalho.id === "string" ? atalho.id : null, rotulo: atalho.rotulo }]
      : [];
  });
  const convite = dados.convite && typeof dados.convite === "object" ? (dados.convite as { nomeProcesso?: unknown }) : null;
  return { atalhos, convite: convite ? { nomeProcesso: typeof convite.nomeProcesso === "string" ? convite.nomeProcesso : "" } : null };
}

export function rotaDoAtalho(atalho: Atalho): string {
  switch (atalho.tipo) {
    case "processo": return atalho.id ? `/processos/${atalho.id}` : "/processos";
    case "acao": case "plano_de_acao": return "/plano-de-acao";
    case "indicador": case "indicadores": return "/indicadores";
    case "documento": case "documentos": return "/documentos";
    case "processos": return "/processos";
  }
}
