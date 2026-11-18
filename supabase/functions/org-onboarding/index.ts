import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mensagemDoErro } from "../_shared/authorization-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return json({ error: "Não autenticado (token ausente)" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[org-onboarding] missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY");
      return json({ error: "Configuração ausente no servidor" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    // Só para o vínculo em membros: a política de INSERT de membros não aceita o dono
    // de uma empresa recém-criada (ele ainda não a enxerga) e recursa em membros.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      console.error("[org-onboarding] auth.getUser error:", userErr);
      return json({ error: "Não autenticado", details: userErr.message }, 401);
    }
    const user = userRes?.user;
    if (!user) {
      return json({ error: "Não autenticado" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const nomeRaw = body?.nome ?? body?.empresaNome;
    const nome = typeof nomeRaw === "string" ? nomeRaw.trim() : "";
    const segmento = body?.segmento ? String(body.segmento).trim() : null;
    const tamanho = body?.tamanho ? String(body.tamanho).trim() : null;
    const area_atuacao = body?.area_atuacao ? String(body.area_atuacao).trim() : null;
    const contexto = body?.contexto ? String(body.contexto).trim() : null;
    const perfil =
      body?.perfil && ["admin", "gestor", "analista"].includes(String(body.perfil))
        ? String(body.perfil)
        : "admin";

    if (!nome) {
      return json({ error: "Nome da empresa é obrigatório" }, 400);
    }

    // 1) Verifica se já existe empresa com mesmo nome para este owner
    const { data: existing, error: existingErr } = await supabase
      .from("empresas")
      .select("id, nome")
      .eq("owner_id", user.id)
      .eq("nome", nome)
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      console.error("[org-onboarding] select existing error:", existingErr);
      return json(
        {
          error: "Erro ao consultar empresa existente",
          code: existingErr.code,
          message: existingErr.message,
          details: existingErr.details,
          hint: existingErr.hint,
        },
        500,
      );
    }

    let empresaId = existing?.id as string | undefined;

    // 2) Insere se não existir
    if (!empresaId) {
      // Sem .select(): a política de SELECT de empresas exige vínculo em membros, que só
      // existe no passo 3; o RETURNING falharia com "new row violates row-level security".
      const novoId = crypto.randomUUID();
      const { error: createErr } = await supabase
        .from("empresas")
        .insert({ id: novoId, nome, segmento, tamanho, area_atuacao, contexto, owner_id: user.id });

      if (createErr) {
        console.error("[org-onboarding] insert empresa error:", createErr, "user:", user.id);
        return json(
          {
            error: "Erro ao criar empresa",
            code: createErr?.code,
            message: createErr?.message,
            details: createErr?.details,
            hint: createErr?.hint,
          },
          400,
        );
      }
      empresaId = novoId;
    }

    // 3) Garante membership (idempotente). empresaId é do próprio usuário: veio do insert
    // com owner_id = user.id ou da busca filtrada por owner_id.
    const { data: membership, error: memSelErr } = await admin
      .from("membros")
      .select("id")
      .eq("user_id", user.id)
      .eq("empresa_id", empresaId)
      .limit(1)
      .maybeSingle();

    if (memSelErr) {
      console.error("[org-onboarding] select membros error:", memSelErr);
      return json({ error: "Erro ao consultar vínculo", message: memSelErr.message }, 500);
    }

    if (!membership) {
      const { error: memberErr } = await admin
        .from("membros")
        .insert({ user_id: user.id, empresa_id: empresaId, perfil, invited_by: user.id });
      if (memberErr) {
        console.error("[org-onboarding] insert membros error:", memberErr);
        return json({ error: "Empresa criada, mas o vínculo falhou", message: memberErr.message }, 500);
      }
    }

    // 4) Retorna a empresa final
    const { data: empresa, error: empFetchErr } = await supabase
      .from("empresas")
      .select("id, nome, segmento, tamanho, area_atuacao, contexto, owner_id, created_at")
      .eq("id", empresaId)
      .single();

    if (empFetchErr || !empresa) {
      console.error("[org-onboarding] fetch empresa error:", empFetchErr);
      return json(
        {
          error: "Empresa criada mas não pôde ser lida",
          code: empFetchErr?.code,
          message: empFetchErr?.message,
        },
        500,
      );
    }

    return json({ empresa });
  } catch (e) {
    const msg = mensagemDoErro(e);
    console.error("[org-onboarding] unhandled error:", msg, e);
    return json({ error: msg }, 500);
  }
});
