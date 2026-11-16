// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mensagemDoErro } from "../_shared/authorization-core.ts";
import { cabecalhosCors } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const corsHeaders = cabecalhosCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase keys não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const inviteId = String(body?.inviteId || "");
    if (!inviteId) {
      return new Response(JSON.stringify({ error: "inviteId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invite, error: inviteError } = await admin
      .from("convites")
      .select("id, empresa_id, status")
      .eq("id", inviteId)
      .maybeSingle();

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!invite) {
      return new Response(JSON.stringify({ error: "Convite não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dono, Consultor, Gestor ou administrador da conta (mesma regra do banco).
    const { data: gerencia, error: permissaoError } = await supabase.rpc("user_can_manage_company", { _empresa_id: invite.empresa_id });
    if (permissaoError) {
      return new Response(JSON.stringify({ error: permissaoError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const canManage = gerencia === true;

    if (!canManage) {
      return new Response(JSON.stringify({ error: "Permissão negada para revogar convites" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.status !== "pending") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updated, error: updateError } = await admin
      .from("convites")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
        revoked_reason: "cancelled",
      })
      .eq("id", inviteId)
      .select("id, email, perfil, status, created_at, expires_at, accepted_at, revoked_at, revoked_reason")
      .single();

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ invite: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[org-revoke-invite]", mensagemDoErro(error), error);
    return new Response(
      JSON.stringify({ error: mensagemDoErro(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
