import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { isSuperAdmin } from "@/lib/permissions";

// Administrador da plataforma: o e-mail original ou a tabela plataforma_admins (is_super_admin no banco).
export function useAdminDaPlataforma(): { admin: boolean; carregando: boolean } {
  const { user, loading } = useAuthUser();
  const porEmail = isSuperAdmin(user);
  const [pelaTabela, setPelaTabela] = useState<boolean | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    let ativo = true;
    setPelaTabela(null);
    if (loading || !userId || porEmail) return;
    void supabase.rpc("is_super_admin").then(({ data, error }) => {
      if (ativo) setPelaTabela(!error && data === true);
    });
    return () => {
      ativo = false;
    };
  }, [loading, userId, porEmail]);

  return { admin: porEmail || pelaTabela === true, carregando: loading || (!porEmail && Boolean(userId) && pelaTabela === null) };
}
