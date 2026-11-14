import { supabase } from "@/integrations/supabase/client";

// Empresas que o usuário vê (dono, membro ou administrador da conta que atende a empresa), com o
// perfil e a conta. Vem da função empresas_do_usuario (migration 202611140001), sem custo de
// implantação; enquanto a migration não estiver aplicada, usa a edge function org-list.
export async function listarEmpresasDoUsuario(): Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }> {
  const { data, error } = await supabase.rpc("empresas_do_usuario");
  if (!error && Array.isArray(data)) return { data: data as Array<Record<string, unknown>>, error: null };
  const reserva = await supabase.functions.invoke("org-list");
  return { data: Array.isArray(reserva.data) ? (reserva.data as Array<Record<string, unknown>>) : null, error: reserva.error };
}
