import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AI_CONFIG_DEFAULTS, type AiConfigType } from "@/data/ai-config-defaults";
import { mensagemDoErro } from "../../supabase/functions/_shared/authorization-core";

async function validateAccessibleCompanyId(companyId: string) {
  try {
    const { data, error } = await supabase
      .from("empresas")
      .select("id")
      .eq("id", companyId)
      .maybeSingle();

    if (error) return null;
    return data?.id ?? null;
  } catch {
    return null;
  }
}

async function resolveActiveCompanyId(userId: string | null) {
  try {
    const localCompanyId = window.localStorage.getItem("process:activeEmpresaId");
    if (localCompanyId) {
      const accessibleCompanyId = await validateAccessibleCompanyId(localCompanyId);
      if (accessibleCompanyId) return accessibleCompanyId;
      window.localStorage.removeItem("process:activeEmpresaId");
    }
    if (!userId) return null;

    const { data: empresas, error: empresasError } = await supabase
      .from("empresas")
      .select("id, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!empresasError) {
      const ownerRows = (empresas as { id: string; created_at: string }[] | null) || [];
      if (ownerRows[0]?.id) return ownerRows[0].id;
    }

    const { data: membros, error: membrosError } = await supabase
      .from("membros")
      .select("empresa_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!membrosError) {
      const memberRows = (membros as { empresa_id: string; created_at: string }[] | null) || [];
      if (memberRows[0]?.empresa_id) return memberRows[0].empresa_id;
    }

    return null;
  } catch {
    return null;
  }
}

export function useAiConfig(configType: AiConfigType) {
  const [content, setContent] = useState<string>(AI_CONFIG_DEFAULTS[configType]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setContent(AI_CONFIG_DEFAULTS[configType]);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) {
        setError(authError.message);
        setCompanyId(null);
        return;
      }
      const userId = auth.user?.id ?? null;
      const activeCompanyId = await resolveActiveCompanyId(userId);
      setCompanyId(activeCompanyId);

      if (!activeCompanyId) {
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("ai_configurations")
        .select("content")
        .eq("company_id", activeCompanyId)
        .eq("config_type", configType)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
        setContent(AI_CONFIG_DEFAULTS[configType]);
        return;
      }

      setContent(data?.content || AI_CONFIG_DEFAULTS[configType]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar configuração");
      setContent(AI_CONFIG_DEFAULTS[configType]);
      setCompanyId(null);
    } finally {
      setIsLoading(false);
    }
  }, [configType]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  // Devolve null quando salvou, ou a causa da falha (PostgrestError não é Error).
  const saveConfig = useCallback(async (nextContent: string): Promise<string | null> => {
    setIsSaving(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = auth.user?.id ?? null;
      const activeCompanyId = companyId ?? await resolveActiveCompanyId(userId);

      if (!activeCompanyId || !userId) {
        throw new Error("Empresa ativa ou usuário autenticado não encontrado");
      }

      const { error: upsertError } = await supabase
        .from("ai_configurations")
        .upsert({
          company_id: activeCompanyId,
          config_type: configType,
          content: nextContent,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id,config_type" });

      if (upsertError) throw upsertError;

      setCompanyId(activeCompanyId);
      setContent(nextContent);
      return null;
    } catch (err) {
      const causa = mensagemDoErro(err);
      setError(causa);
      return causa;
    } finally {
      setIsSaving(false);
    }
  }, [companyId, configType]);

  return {
    companyId,
    content,
    setContent,
    saveConfig,
    isLoading,
    isSaving,
    error,
    refetch: loadConfig,
  };
}
