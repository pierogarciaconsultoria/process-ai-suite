import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

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

function getExpirationDate(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendWithResend(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Falha ao enviar email via Resend: ${details}`);
  }
}

async function sendWithSmtp(args: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const transport = nodemailer.createTransport({
    host: args.host,
    port: args.port,
    secure: args.secure,
    auth: {
      user: args.user,
      pass: args.pass,
    },
  });

  await transport.sendMail({
    from: args.from,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
}

async function sendInviteEmail(args: {
  appBaseUrl: string;
  companyName: string;
  inviteEmail: string;
  invitedByName: string;
  perfil: string;
  token: string;
  expiresAt: string;
}) {
  const inviteUrl = `${args.appBaseUrl.replace(/\/$/, "")}/convite/${args.token}`;
  const expiresLabel = new Date(args.expiresAt).toLocaleString("pt-BR");
  const safeCompany = escapeHtml(args.companyName);
  const safeInviter = escapeHtml(args.invitedByName);
  const safePerfil = escapeHtml(args.perfil);
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2>Voce recebeu um convite para acessar o Process Intelligence</h2>
      <p><strong>${safeInviter}</strong> convidou voce para acessar a empresa <strong>${safeCompany}</strong> com o perfil <strong>${safePerfil}</strong>.</p>
      <p>Use o link abaixo para aceitar o convite:</p>
      <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;">Aceitar convite</a></p>
      <p>Se preferir, copie e cole este link no navegador:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>Este convite expira em <strong>${expiresLabel}</strong>.</p>
    </div>
  `;
  const text = [
    "Voce recebeu um convite para acessar o Process Intelligence.",
    `${args.invitedByName} convidou voce para a empresa ${args.companyName} com o perfil ${args.perfil}.`,
    `Aceite o convite em: ${inviteUrl}`,
    `Expiracao: ${expiresLabel}`,
  ].join("\n");

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") ?? Deno.env.get("INVITE_FROM_EMAIL");
  if (resendApiKey && resendFrom) {
    await sendWithResend({
      apiKey: resendApiKey,
      from: resendFrom,
      to: args.inviteEmail,
      subject: `Convite para acessar ${args.companyName}`,
      html,
      text,
    });
    return;
  }

  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const smtpFrom = Deno.env.get("SMTP_FROM_EMAIL") ?? Deno.env.get("INVITE_FROM_EMAIL");
  if (smtpHost && smtpUser && smtpPass && smtpFrom) {
    await sendWithSmtp({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      user: smtpUser,
      pass: smtpPass,
      from: smtpFrom,
      to: args.inviteEmail,
      subject: `Convite para acessar ${args.companyName}`,
      html,
      text,
    });
    return;
  }

  throw new Error("Nenhum provedor de email configurado. Defina RESEND_API_KEY/RESEND_FROM_EMAIL ou SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM_EMAIL.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const tokenHeader = authHeader.replace("Bearer ", "");

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
      global: { headers: { Authorization: `Bearer ${tokenHeader}` } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    const requestedBaseUrl = typeof body?.appBaseUrl === "string" ? body.appBaseUrl.trim() : "";
    const appBaseUrl = requestedBaseUrl || Deno.env.get("INVITE_APP_BASE_URL") || req.headers.get("origin") || SUPABASE_URL;
    const expirationHours = Number(Deno.env.get("INVITE_EXPIRATION_HOURS") ?? "168");
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

    const { data: company } = await supabase
      .from("empresas")
      .select("id, nome")
      .eq("id", empresaId)
      .single();
    const companyName = company?.nome || "sua empresa";
    const invitedByName =
      typeof user.user_metadata?.nome === "string" && user.user_metadata.nome.trim()
        ? user.user_metadata.nome.trim()
        : user.email || "Administrador";

    const { data: existing, error: existingError } = await admin
      .from("convites")
      .select("id, status, token, expires_at")
      .eq("empresa_id", empresaId)
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) {
      return new Response(JSON.stringify({ error: existingError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (existing?.status === "pending" && existing.expires_at && new Date(existing.expires_at).getTime() <= Date.now()) {
      await admin
        .from("convites")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
          revoked_reason: "expired",
        })
        .eq("id", existing.id);
    }

    let inviteToken = existing?.status === "pending" ? existing.token : null;
    let expiresAt = existing?.status === "pending" ? existing.expires_at : null;
    let inviteId = existing?.id ?? null;

    if (!inviteToken || !expiresAt) {
      inviteToken = token();
      expiresAt = getExpirationDate(expirationHours);
      const { data: invite, error } = await admin
        .from("convites")
        .insert({
          empresa_id: empresaId,
          email,
          perfil,
          status: "pending",
          token: inviteToken,
          expires_at: expiresAt,
        })
        .select("id, empresa_id, email, perfil, status, token, created_at, expires_at")
        .single();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      inviteId = invite.id;
    } else {
      await admin
        .from("convites")
        .update({
          expires_at: expiresAt,
          revoked_at: null,
          revoked_by: null,
          revoked_reason: null,
        })
        .eq("id", inviteId);
    }

    try {
      await sendInviteEmail({
        appBaseUrl,
        companyName,
        inviteEmail: email,
        invitedByName,
        perfil,
        token: inviteToken,
        expiresAt,
      });
    } catch (error) {
      if (inviteId) {
        await admin
          .from("convites")
          .update({
            status: "revoked",
            revoked_at: new Date().toISOString(),
            revoked_by: user.id,
            revoked_reason: "delivery_failed",
          })
          .eq("id", inviteId);
      }

      const message = error instanceof Error ? error.message : "Falha ao enviar email";
      return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: invite, error: inviteError } = await admin
      .from("convites")
      .select("id, empresa_id, email, perfil, status, token, created_at, expires_at")
      .eq("id", inviteId)
      .single();
    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
