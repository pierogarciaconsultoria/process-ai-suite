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

// Anexos de uma mensagem do usuário (nome e tipo), para mostrar no balão.
export function lerAnexos(extras: Json | null | undefined): Array<{ nome: string; tipo: string }> {
  const dados = extras && typeof extras === "object" && !Array.isArray(extras) ? (extras as Record<string, unknown>) : {};
  return (Array.isArray(dados.anexos) ? dados.anexos : []).flatMap((item) => {
    const anexo = item as { nome?: unknown; tipo?: unknown } | null;
    return anexo && typeof anexo.nome === "string" ? [{ nome: anexo.nome, tipo: typeof anexo.tipo === "string" ? anexo.tipo : "" }] : [];
  });
}

// Tipos aceitos no chat: Word, PDF e imagem (lidos no navegador pelo mesmo leitor da entrevista).
export const ACEITOS_NO_CHAT = ".pdf,.docx,.png,.jpg,.jpeg";
const EXTENSAO_ACEITA = /\.(pdf|docx|png|jpe?g)$/i;

export function aceitoNoChat(arquivo: { name: string }): boolean {
  return EXTENSAO_ACEITA.test(arquivo.name);
}
