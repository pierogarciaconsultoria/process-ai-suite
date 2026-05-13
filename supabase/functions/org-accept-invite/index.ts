// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type InviteRecord = {
  id: string;
  empresa_id: string;
  email: string;
  perfil: string;
  status: string;
  token: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  empresas: { id: string; nome: string } | null;
};

async function revokeIfExpired(admin: ReturnType<typeof createClient>, invite: InviteRecord) {
  if (invite.status !== "pending") {
    return invite;
  }

  if (new Date(invite.expires_at).getTime() > Date.now()) {
    return invite;
  }

  const { data, error } = await admin
    .from("convites")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_reason: "expired",
    })
    .eq("id", invite.id)
    .select("id, empresa_id, email, perfil, status, token, expires_at, accepted_at, revoked_at, revoked_reason, empresas:empresa_id ( id, nome )")
    .single();

  if (error) {
    throw error;
  }

  return data as InviteRecord;
}

serve(async (req: Request) => {
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
      global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const action = String(body?.action || "inspect");
    const token = String(body?.token || "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token do convite é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inviteRow, error: inviteError } = await admin
      .from("convites")
      .select("id, empresa_id, email, perfil, status, token, expires_at, accepted_at, revoked_at, revoked_reason, empresas:empresa_id ( id, nome )")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!inviteRow) {
      return new Response(JSON.stringify({ error: "Convite não encontrado ou inválido" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invite = await revokeIfExpired(admin, inviteRow as InviteRecord);
    const payload = {
      invite: {
        id: invite.id,
        email: invite.email,
        perfil: invite.perfil,
        status: invite.status,
        expires_at: invite.expires_at,
        accepted_at: invite.accepted_at,
        revoked_at: invite.revoked_at,
        revoked_reason: invite.revoked_reason,
        empresa: invite.empresas,
      },
    };

    if (action !== "accept") {
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user || !user.email) {
      return new Response(JSON.stringify({ error: "Faça login para aceitar o convite" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.status !== "pending") {
      return new Response(JSON.stringify({ error: "Este convite não está mais disponível", ...payload }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "O email autenticado não corresponde ao convite", ...payload }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingMember, error: memberError } = await admin
      .from("membros")
      .select("id, perfil")
      .eq("empresa_id", invite.empresa_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) {
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!existingMember) {
      const { error: insertError } = await admin
        .from("membros")
        .insert({
          user_id: user.id,
          empresa_id: invite.empresa_id,
          perfil: invite.perfil,
          invited_by: null,
        });

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: acceptedInvite, error: acceptError } = await admin
      .from("convites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
        revoked_at: null,
        revoked_by: null,
        revoked_reason: null,
      })
      .eq("id", invite.id)
      .select("id, empresa_id, email, perfil, status, token, expires_at, accepted_at, revoked_at, revoked_reason, empresas:empresa_id ( id, nome )")
      .single();

    if (acceptError) {
      return new Response(JSON.stringify({ error: acceptError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      invite: {
        id: acceptedInvite.id,
        email: acceptedInvite.email,
        perfil: acceptedInvite.perfil,
        status: acceptedInvite.status,
        expires_at: acceptedInvite.expires_at,
        accepted_at: acceptedInvite.accepted_at,
        revoked_at: acceptedInvite.revoked_at,
        revoked_reason: acceptedInvite.revoked_reason,
        empresa: acceptedInvite.empresas,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
