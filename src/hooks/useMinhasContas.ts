import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MinhaConta = { id: string; nome: string; tipo: string; plano: string; situacao: string; papel: string; limite_empresas: number | null; empresas: number };

// Contas de que o usuário participa (administrador primeiro). Vazio enquanto carrega ou sem a migration.
export function useMinhasContas(): MinhaConta[] {
  const [contas, setContas] = useState<MinhaConta[]>([]);
  useEffect(() => {
    let ativo = true;
    void supabase.rpc("minhas_contas").then(({ data, error }) => {
      if (ativo && !error && Array.isArray(data)) setContas(data as MinhaConta[]);
    });
    return () => {
      ativo = false;
    };
  }, []);
  return contas;
}
