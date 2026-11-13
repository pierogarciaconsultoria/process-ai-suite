// Leitura do padrão de procedimento no banco (só nas edge functions).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escolherPadrao, tipoDaEstrutura, type LinhaPadrao, type PadraoProcedimento } from "./procedimento-padrao.ts";

export async function carregarPadrao(client: SupabaseClient, companyId: string, tipoDocumento: string): Promise<PadraoProcedimento> {
  const { data, error } = await client
    .from("padroes_documento")
    .select("company_id, tipo, conteudo")
    .in("tipo", [tipoDaEstrutura(tipoDocumento), "manual_escrita", "exemplo_atividade"])
    .or(`company_id.is.null,company_id.eq.${companyId}`);
  // Tabela ainda não criada (migration não aplicada): segue com o padrão genérico.
  if (error) console.warn("padroes_documento indisponível", error);
  return escolherPadrao((data ?? []) as LinhaPadrao[], companyId, tipoDocumento);
}
