import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AI_CONFIG_DEFAULTS, type AiConfigType } from "@/data/ai-config-defaults";

async function resolveActiveCompanyId(userId: string | null) {
  const localCompanyId = window.localStorage.getItem("process:activeEmpresaId");
  if (localCompanyId) return localCompanyId;
  if (!userId) return null;

  const { data: membros } = await supabase
    .from("membros")
    .select("empresa_id")
    .eq("user_id", userId)
    .limit(1);

  const memberRows = (membros as { empresa_id: string }[] | null) || [];
  if (memberRows[0]?.empresa_id) return memberRows[0].empresa_id;

  const { data: empresas } = await supabase
    .from("empresas")
    .select("id")
    .eq("owner_id", userId)
    .limit(1);

  const ownerRows = (empresas as { id: string }[] | null) || [];
  return ownerRows[0]?.id ?? null;
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
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;
      const activeCompanyId = await resolveActiveCompanyId(userId);
      setCompanyId(activeCompanyId);

      if (!activeCompanyId) {
        setContent(AI_CONFIG_DEFAULTS[configType]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("ai_configurations")
        .select("content")
        .eq("company_id", activeCompanyId)
        .eq("config_type", configType)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setContent(data?.content || AI_CONFIG_DEFAULTS[configType]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar configuração");
      setContent(AI_CONFIG_DEFAULTS[configType]);
    } finally {
      setIsLoading(false);
    }
  }, [configType]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const saveConfig = useCallback(async (nextContent: string) => {
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configuração");
      return false;
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
