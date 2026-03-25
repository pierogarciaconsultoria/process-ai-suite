import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function token(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const tokenHeader = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase service role não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${tokenHeader}` } },
    });

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const empresaId = String(body?.empresaId || "");
    const email = String(body?.email || "").trim().toLowerCase();
    const perfilRaw = String(body?.perfil || "analista");
    const perfil = ["admin", "gestor", "analista"].includes(perfilRaw) ? perfilRaw : "analista";
    if (!empresaId || !email) {
      return new Response(JSON.stringify({ error: "empresaId e email são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: membership } = await supabase
      .from("membros")
      .select("perfil")
      .eq("empresa_id", empresaId)
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: empresa } = await supabase
      .from("empresas")
      .select("owner_id")
      .eq("id", empresaId)
      .single();
    const canInvite = membership && ["admin", "gestor"].includes(membership.perfil) || empresa?.owner_id === user.id;
    if (!canInvite) {
      return new Response(JSON.stringify({ error: "Permissão negada para convidar" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: existing } = await supabase
      .from("convites")
      .select("id, status")
      .eq("empresa_id", empresaId)
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (existing && existing.status === "pending") {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const t = token();
    const { data: invite, error } = await supabase
      .from("convites")
      .insert({
        empresa_id: empresaId,
        email,
        perfil,
        status: "pending",
        token: t,
      })
      .select("id, empresa_id, email, perfil, status, token, created_at")
      .single();
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ invite }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
