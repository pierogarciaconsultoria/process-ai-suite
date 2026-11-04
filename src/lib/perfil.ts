import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Perfis na empresa (migration 202611050001). Os valores gravados ficam como estão; a tela usa estes nomes.
export type PerfilGravado = "admin" | "gestor" | "analista";

export const ROTULO_PERFIL: Record<string, string> = {
  owner: "Consultor",
  admin: "Consultor",
  gestor: "Gestor",
  analista: "Equipe",
};

export const DESCRICAO_PERFIL: Record<PerfilGravado, string> = {
  admin: "Consultoria: faz tudo, inclusive aprovar documentos e convidar pessoas.",
  gestor: "Dono ou gerente do cliente: faz tudo na empresa, inclusive aprovar documentos e convidar pessoas.",
  analista: "Colaboradores: participam das entrevistas, lançam resultados e atualizam ações. Não excluem nem aprovam.",
};

export function rotuloDoPerfil(perfil: string | null | undefined): string {
  return ROTULO_PERFIL[perfil ?? ""] ?? perfil ?? "";
}

// Consultor (dono ou admin) e Gestor podem excluir, aprovar e mudar definições; a Equipe não.
export function usePodeGerenciar(companyId: string | null): boolean {
  const [pode, setPode] = useState(false);
  useEffect(() => {
    let ativo = true;
    setPode(false);
    if (!companyId) return;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      const [{ data: empresa }, { data: membro }] = await Promise.all([
        supabase.from("empresas").select("owner_id").eq("id", companyId).maybeSingle(),
        supabase.from("membros").select("perfil").eq("empresa_id", companyId).eq("user_id", userId).maybeSingle(),
      ]);
      if (ativo) setPode(empresa?.owner_id === userId || membro?.perfil === "admin" || membro?.perfil === "gestor");
    })();
    return () => {
      ativo = false;
    };
  }, [companyId]);
  return pode;
}
