import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const nomeRaw = body?.nome ?? body?.empresaNome;
    const nome = typeof nomeRaw === "string" ? nomeRaw.trim() : "";
    const segmento = body?.segmento ? String(body.segmento).trim() : null;
    const tamanho = body?.tamanho ? String(body.tamanho).trim() : null;
    const area_atuacao = body?.area_atuacao ? String(body.area_atuacao).trim() : null;
    const contexto = body?.contexto ? String(body.contexto).trim() : null;
    const perfil = body?.perfil && ["admin","gestor","analista"].includes(String(body.perfil)) ? String(body.perfil) : "admin";

    if (!nome) {
      return new Response(
        JSON.stringify({ error: "Nome da empresa é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: existing, error: existingErr } = await supabase
      .from("empresas")
      .select("id, nome")
      .eq("owner_id", user.id)
      .eq("nome", nome)
      .limit(1)
      .maybeSingle();
    if (existingErr) {
      return new Response(JSON.stringify({ error: existingErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let empresaId = existing?.id;

    if (!empresaId) {
      const { data: empresaCreated, error: createErr } = await supabase
        .from("empresas")
        .insert({ nome, segmento, tamanho, area_atuacao, contexto, owner_id: user.id })
        .select("id, nome, segmento, tamanho, area_atuacao, contexto, owner_id, created_at")
        .single();
      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      empresaId = empresaCreated.id;
    }

    const { data: membership } = await supabase
      .from("membros")
      .select("id")
      .eq("user_id", user.id)
      .eq("empresa_id", empresaId)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      const { error: memberErr } = await supabase
        .from("membros")
        .insert({ user_id: user.id, empresa_id: empresaId, perfil, invited_by: user.id });
      if (memberErr) {
        return new Response(JSON.stringify({ error: memberErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: empresa } = await supabase
      .from("empresas")
      .select("id, nome, segmento, tamanho, area_atuacao, contexto, owner_id, created_at")
      .eq("id", empresaId)
      .single();

    return new Response(JSON.stringify({ empresa }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
