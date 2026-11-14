import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isSuperAdmin } from "@/lib/permissions";

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
      // A regra do banco (dono, Consultor ou Gestor da empresa, ou administrador da conta).
      const { data, error } = await supabase.rpc("user_can_manage_company", { _empresa_id: companyId });
      if (!error) {
        if (ativo) setPode(data === true);
        return;
      }
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

// Consultor: dono de alguma empresa, Consultor (admin) em alguma delas, ou o super admin.
// É quem vê a carteira de empresas ("Minhas empresas", em Configurações).
export function ehConsultor(entrada: { superAdmin: boolean; donoDeAlguma: boolean; consultorEmAlguma: boolean }): boolean {
  return entrada.superAdmin || entrada.donoDeAlguma || entrada.consultorEmAlguma;
}

// null enquanto verifica.
export function useEhConsultor(): boolean | null {
  const [consultor, setConsultor] = useState<boolean | null>(null);
  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        if (ativo) setConsultor(false);
        return;
      }
      const [{ data: empresas }, { data: membros }, { data: contas }] = await Promise.all([
        supabase.from("empresas").select("id").eq("owner_id", user.id).limit(1),
        supabase.from("membros").select("empresa_id").eq("user_id", user.id).eq("perfil", "admin").limit(1),
        supabase.rpc("minhas_contas"),
      ]);
      if (ativo) {
        setConsultor(ehConsultor({
          superAdmin: isSuperAdmin(user),
          donoDeAlguma: (empresas?.length ?? 0) > 0,
          // Consultor ou administrador da empresa, ou quem faz parte de uma conta.
          consultorEmAlguma: (membros?.length ?? 0) > 0 || (Array.isArray(contas) && contas.length > 0),
        }));
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);
  return consultor;
}
