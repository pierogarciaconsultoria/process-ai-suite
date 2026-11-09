import { supabase } from "@/integrations/supabase/client";
import {
  ESTRUTURA_IT_PADRAO,
  ESTRUTURA_PR_PADRAO,
  MANUAL_PADRAO,
  type TipoPadrao,
} from "../../supabase/functions/_shared/procedimento-padrao";

// Padrão de procedimento do Peter (tabela padroes_documento, migration 202611070001).
// Escopo null = plataforma (todas as empresas); um id = padrão próprio daquela empresa.

export const TIPOS_PADRAO: Array<{ tipo: TipoPadrao; rotulo: string; ajuda: string; exemplo: string }> = [
  {
    tipo: "estrutura_pr",
    rotulo: "Estrutura do procedimento (PR/PA)",
    ajuda: "As seções, na ordem, com o que cada uma deve conter e as tabelas. Vale para Procedimento e POP.",
    exemplo: ESTRUTURA_PR_PADRAO,
  },
  {
    tipo: "estrutura_it",
    rotulo: "Estrutura da instrução de trabalho (IT)",
    ajuda: "As seções da IT. Em branco, a IT usa a estrutura genérica de IT do Peter.",
    exemplo: ESTRUTURA_IT_PADRAO,
  },
  {
    tipo: "manual_escrita",
    rotulo: "Manual de escrita",
    ajuda: "Como redigir: verbos, cargo, condição de entrada, decisões, 5S, EPIs, cláusulas padrão. Vale para PR e IT.",
    exemplo: MANUAL_PADRAO,
  },
];

export type ConteudoPadrao = Record<TipoPadrao, string>;

export const PADRAO_VAZIO: ConteudoPadrao = { estrutura_pr: "", estrutura_it: "", manual_escrita: "" };

export async function carregarPadroes(companyId: string | null): Promise<ConteudoPadrao> {
  const consulta = supabase.from("padroes_documento").select("tipo, conteudo");
  const { data, error } = await (companyId ? consulta.eq("company_id", companyId) : consulta.is("company_id", null));
  if (error) throw error;
  const conteudo = { ...PADRAO_VAZIO };
  for (const linha of data ?? []) {
    if (linha.tipo in conteudo) conteudo[linha.tipo as TipoPadrao] = linha.conteudo;
  }
  return conteudo;
}

// Texto vazio apaga o registro: volta a valer o padrão da plataforma (ou o genérico).
export async function salvarPadrao(companyId: string | null, tipo: TipoPadrao, conteudo: string): Promise<void> {
  const texto = conteudo.trim();
  const busca = supabase.from("padroes_documento").select("id").eq("tipo", tipo);
  const { data: existente, error: erroBusca } = await (companyId ? busca.eq("company_id", companyId) : busca.is("company_id", null)).maybeSingle();
  if (erroBusca) throw erroBusca;
  if (!texto) {
    if (existente) {
      const { error } = await supabase.from("padroes_documento").delete().eq("id", existente.id);
      if (error) throw error;
    }
    return;
  }
  const { error } = existente
    ? await supabase.from("padroes_documento").update({ conteudo: texto }).eq("id", existente.id)
    : await supabase.from("padroes_documento").insert({ company_id: companyId, tipo, conteudo: texto });
  if (error) throw error;
}
