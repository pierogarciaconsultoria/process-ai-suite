import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { indicadoresAindaNaoEnviados } from "@/lib/indicadores";
import { acoesAindaNaoEnviadas } from "@/lib/plano-de-acao";

// Plano aprovado na entrevista: os indicadores sugeridos e as ações do 5W2H passam a ser
// acompanhados nos módulos Indicadores e Plano de Ação. Só cria o que ainda não existe.
export async function criarAcompanhamento(processo: Tables<"processos">, userId: string): Promise<{ indicadores: number; acoes: number }> {
  const filtro = { processo_id: processo.id, company_id: processo.company_id };
  const [existentesIndicadores, existentesAcoes] = await Promise.all([
    supabase.from("indicadores").select("*").match(filtro),
    supabase.from("acoes").select("*").match(filtro),
  ]);
  if (existentesIndicadores.error) throw existentesIndicadores.error;
  if (existentesAcoes.error) throw existentesAcoes.error;

  const indicadores = indicadoresAindaNaoEnviados(processo, existentesIndicadores.data ?? [], userId);
  const acoes = acoesAindaNaoEnviadas(processo, existentesAcoes.data ?? [], userId);
  if (indicadores.length) {
    const { error } = await supabase.from("indicadores").insert(indicadores);
    if (error) throw error;
  }
  if (acoes.length) {
    const { error } = await supabase.from("acoes").insert(acoes);
    if (error) throw error;
  }
  return { indicadores: indicadores.length, acoes: acoes.length };
}
