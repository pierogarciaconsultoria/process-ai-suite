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
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: membros, error: memErr } = await supabase.from("membros").select("empresa_id").eq("user_id", user.id);
    if (memErr) {
      const { data: empresasOwner, error: empOwnerErr } = await supabase
        .from("empresas")
        .select("id, nome, segmento, tamanho, area_atuacao, contexto, owner_id, created_at")
        .eq("owner_id", user.id);
      if (empOwnerErr) {
        return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(empresasOwner || []), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ids = Array.from(new Set((membros || []).map((m: { empresa_id: string }) => m.empresa_id)));
    if (ids.length === 0) {
      const { data: empresasOwner } = await supabase
        .from("empresas")
        .select("id, nome, segmento, tamanho, owner_id, created_at")
        .eq("owner_id", user.id);
      return new Response(JSON.stringify(empresasOwner || []), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: empresas, error: empErr } = await supabase
      .from("empresas")
      .select("id, nome, segmento, tamanho, area_atuacao, contexto, owner_id, created_at")
      .in("id", ids);
    if (empErr) {
      return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(empresas || []), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
