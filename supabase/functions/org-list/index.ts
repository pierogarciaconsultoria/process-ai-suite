// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mensagemDoErro } from "../_shared/authorization-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EmpresaRow = {
  id: string;
  nome: string;
  segmento: string | null;
  owner_id: string;
};

type MembroRow = {
  empresa_id: string;
  perfil: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase anon key não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: empresasOwner, error: empOwnerErr } = await supabase
      .from("empresas")
      .select("id, nome, segmento, owner_id")
      .eq("owner_id", user.id);

    if (empOwnerErr) {
      throw new Error(`Erro ao buscar empresas do owner: ${empOwnerErr.message}`);
    }

    const { data: membros, error: memErr } = await supabase
      .from("membros")
      .select("empresa_id, perfil")
      .eq("user_id", user.id);

    if (memErr) {
      throw new Error(`Erro ao buscar memberships do usuário: ${memErr.message}`);
    }

    const membershipRows = (membros as MembroRow[] | null) || [];
    const memberCompanyIds = Array.from(new Set(membershipRows.map((m) => m.empresa_id).filter(Boolean)));

    let empresasMembro: EmpresaRow[] = [];
    if (memberCompanyIds.length > 0) {
      const { data: memberCompanies, error: memberCompaniesError } = await supabase
        .from("empresas")
        .select("id, nome, segmento, owner_id")
        .in("id", memberCompanyIds);

      if (memberCompaniesError) {
        throw new Error(`Erro ao buscar empresas por membership: ${memberCompaniesError.message}`);
      }

      empresasMembro = (memberCompanies as EmpresaRow[] | null) || [];
    }

    const empresasMap = new Map<string, {
      id: string;
      nome: string;
      segmento: string | null;
      logo_url: string | null;
      perfil: string;
    }>();

    for (const empresa of (empresasOwner as EmpresaRow[] | null) || []) {
      empresasMap.set(empresa.id, {
        id: empresa.id,
        nome: empresa.nome,
        segmento: empresa.segmento,
        logo_url: null,
        perfil: "owner",
      });
    }

    for (const empresa of empresasMembro) {
      const membership = membershipRows.find((item) => item.empresa_id === empresa.id);
      const existing = empresasMap.get(empresa.id);
      empresasMap.set(empresa.id, {
        id: empresa.id,
        nome: empresa.nome,
        segmento: empresa.segmento,
        logo_url: null,
        perfil: existing?.perfil === "owner" ? "owner" : (membership?.perfil || "analista"),
      });
    }

    const empresas = Array.from(empresasMap.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return new Response(JSON.stringify(empresas), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = mensagemDoErro(e);
    console.error("[org-list]", msg, e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
