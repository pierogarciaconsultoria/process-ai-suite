// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mensagemDoErro } from "../_shared/authorization-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase keys não configurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const empresaId = String(body?.empresaId || "");
    if (!empresaId) {
      return new Response(JSON.stringify({ error: "empresaId é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: membership } = await supabase
      .from("membros")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: empresa } = await supabase
      .from("empresas")
      .select("owner_id")
      .eq("id", empresaId)
      .single();
    if (!membership && empresa?.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin
      .from("convites")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_reason: "expired",
      })
      .eq("empresa_id", empresaId)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    const { data: membros, error: memErr } = await supabase
      .from("membros")
      .select("id, user_id, perfil, created_at")
      .eq("empresa_id", empresaId);
    if (memErr) {
      return new Response(JSON.stringify({ error: memErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const users: Record<string, { id: string; email: string; nome?: string }> = {};
    for (const m of membros || []) {
      const { data: u } = await admin.auth.admin.getUserById(m.user_id);
      if (u?.user) {
        users[m.user_id] = {
          id: u.user.id,
          email: u.user.email || "",
          nome: typeof u.user.user_metadata?.nome === "string" ? u.user.user_metadata.nome : undefined,
        };
      }
    }

    const { data: invites, error: invErr } = await supabase
      .from("convites")
      .select("id, email, perfil, status, created_at, expires_at, accepted_at, revoked_at, revoked_reason")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (invErr) {
      return new Response(JSON.stringify({ error: invErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ membros, users, invites }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[org-members]", mensagemDoErro(e), e);
    return new Response(
      JSON.stringify({ error: mensagemDoErro(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
