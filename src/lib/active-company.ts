import { supabase } from "@/integrations/supabase/client";

export function getStoredActiveCompanyId() {
  return window.localStorage.getItem("process:activeEmpresaId");
}

export async function resolveAccessibleCompanyId(
  userId: string | null,
  preferredCompanyId?: string | null,
) {
  const activeCompanyId = preferredCompanyId ?? getStoredActiveCompanyId();

  if (activeCompanyId) {
    if (!userId) return activeCompanyId;

    const { data: ownedCompany, error: ownedCompanyError } = await supabase
      .from("empresas")
      .select("id")
      .eq("id", activeCompanyId)
      .eq("owner_id", userId)
      .maybeSingle();

    if (!ownedCompanyError && ownedCompany?.id) {
      return ownedCompany.id;
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("membros")
      .select("empresa_id, created_at")
      .eq("user_id", userId)
      .eq("empresa_id", activeCompanyId)
      .order("created_at", { ascending: true });

    const membershipRows = (memberships as { empresa_id: string; created_at: string }[] | null) || [];
    if (!membershipsError && membershipRows[0]?.empresa_id) {
      return membershipRows[0].empresa_id;
    }

    if (preferredCompanyId == null) {
      window.localStorage.removeItem("process:activeEmpresaId");
    }
  }

  if (!userId) return null;

  const { data: ownedCompanies, error: ownedCompaniesError } = await supabase
    .from("empresas")
    .select("id, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });

  const ownedRows = (ownedCompanies as { id: string; created_at: string }[] | null) || [];
  if (!ownedCompaniesError && ownedRows[0]?.id) {
    return ownedRows[0].id;
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("membros")
    .select("empresa_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const membershipRows = (memberships as { empresa_id: string; created_at: string }[] | null) || [];
  if (!membershipsError && membershipRows[0]?.empresa_id) {
    return membershipRows[0].empresa_id;
  }

  return null;
}
