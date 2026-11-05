import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeCompany, errorResponse, HttpError, requireString } from "../_shared/auth.ts";
import { acquireAiQuota } from "../_shared/quota.ts";
import { callResponsesAPI } from "../_shared/openai-assistant.ts";
import { checkModeration } from "../_shared/moderation.ts";
import { carregarPersonaPeter } from "../_shared/peter-persona.ts";
import { normalizarDiagnostico, normalizarPlano } from "../_shared/roteiro-analise.ts";
import {
  anexosParaGuardar,
  escolherRelevantes,
  lerRespostaChat,
  MAX_CONTEUDO_DOCUMENTO,
  MAX_MENSAGEM_CHAT,
  MAX_HISTORICO_CHAT,
  partesDaMensagem,
  promptChat,
  sanitizarHistoricoChat,
  SCHEMA_CHAT,
  tituloDaConversa,
  validarAnexosChat,
  type ContextoEmpresa,
  type DetalheProcesso,
} from "../_shared/peter-chat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Linha = Record<string, unknown>;

const str = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");
const lista = (valor: unknown): Linha[] => (Array.isArray(valor) ? valor.filter((item) => item && typeof item === "object") as Linha[] : []);

// Uma tabela ainda não criada (migration não aplicada) não derruba o chat: entra vazia.
async function ler(consulta: PromiseLike<{ data: unknown; error: unknown }>, tabela: string): Promise<Linha[]> {
  const { data, error } = await consulta;
  if (error) {
    console.warn(`ai-peter-chat: ${tabela} indisponível`, error);
    return [];
  }
  return lista(data);
}

function hojeEmSaoPaulo(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function seisMesesAtras(hoje: string): string {
  const [ano, mes] = hoje.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 7, 1));
  return data.toISOString().slice(0, 10);
}

function metaDoIndicador(linha: Linha): string {
  if (typeof linha.meta !== "number") return str(linha.meta_texto) || "sem meta";
  return `${linha.sentido === "menor" ? "≤" : "≥"} ${linha.meta}${str(linha.unidade) ? ` ${str(linha.unidade)}` : ""}`;
}

function situacao(linha: Linha, valor: number): string {
  if (typeof linha.meta !== "number") return "sem meta";
  return (linha.sentido === "menor" ? valor <= linha.meta : valor >= linha.meta) ? "dentro da meta" : "fora da meta";
}

async function montarContexto(client: SupabaseClient, companyId: string, busca: string): Promise<ContextoEmpresa> {
  const hoje = hojeEmSaoPaulo();
  const [processos, documentos, acoes, indicadores, medicoes] = await Promise.all([
    ler(client.from("processos").select("id, nome, area, responsavel, status, objetivo, updated_at").eq("company_id", companyId).order("updated_at", { ascending: false }).limit(200), "processos"),
    ler(client.from("generated_documents").select("id, code, title, document_type, status, revision, process_id").eq("company_id", companyId).is("archived_at", null).order("updated_at", { ascending: false }).limit(200), "generated_documents"),
    ler(client.from("acoes").select("id, oque, quem, prazo, quando_texto, status, processo_id, origem").eq("company_id", companyId).order("prazo", { ascending: true, nullsFirst: false }).limit(300), "acoes"),
    ler(client.from("indicadores").select("id, nome, processo_id, meta, sentido, unidade, meta_texto, responsavel").eq("company_id", companyId).order("nome").limit(150), "indicadores"),
    ler(client.from("indicador_medicoes").select("indicador_id, periodo, valor").eq("company_id", companyId).gte("periodo", seisMesesAtras(hoje)).order("periodo"), "indicador_medicoes"),
  ]);

  const contexto: ContextoEmpresa = {
    hoje,
    processos: processos.map((linha) => ({
      id: str(linha.id), nome: str(linha.nome), area: str(linha.area), dono: str(linha.responsavel),
      status: str(linha.status), objetivo: str(linha.objetivo).slice(0, 300), atualizadoEm: str(linha.updated_at),
    })),
    documentos: documentos.map((linha) => ({
      id: str(linha.id), codigo: str(linha.code), titulo: str(linha.title), tipo: str(linha.document_type),
      status: str(linha.status), revisao: str(linha.revision), processoId: str(linha.process_id) || null,
    })),
    acoes: acoes.map((linha) => ({
      id: str(linha.id), oque: str(linha.oque), quem: str(linha.quem), prazo: str(linha.prazo) || null,
      quandoTexto: str(linha.quando_texto), status: str(linha.status), processoId: str(linha.processo_id) || null, origem: str(linha.origem),
    })),
    indicadores: indicadores.map((linha) => ({
      id: str(linha.id), nome: str(linha.nome), processoId: str(linha.processo_id) || null, meta: metaDoIndicador(linha), responsavel: str(linha.responsavel),
      resultados: medicoes
        .filter((medicao) => medicao.indicador_id === linha.id && typeof medicao.valor === "number")
        .map((medicao) => ({ periodo: str(medicao.periodo).slice(0, 7), valor: String(medicao.valor), situacao: situacao(linha, medicao.valor as number) })),
    })),
    conteudos: [],
    detalhes: [],
  };

  const relevantes = escolherRelevantes(busca, contexto.processos, contexto.documentos);
  const [detalhes, conteudos] = await Promise.all([
    relevantes.processos.length
      ? ler(client.from("processos").select("id, gatilho, etapas, entradas, saidas, entrevista_roteiro").in("id", relevantes.processos), "processos")
      : Promise.resolve([]),
    relevantes.documentos.length
      ? ler(client.from("generated_documents").select("id, content_markdown").in("id", relevantes.documentos), "generated_documents")
      : Promise.resolve([]),
  ]);
  contexto.detalhes = detalhes.map((linha): DetalheProcesso => {
    const analises = (linha.entrevista_roteiro as { analises?: Record<string, unknown> } | null)?.analises ?? {};
    const diagnostico = normalizarDiagnostico(analises.diagnostico_as_is);
    const plano = normalizarPlano(analises.plano_melhoria);
    return {
      id: str(linha.id),
      gatilho: str(linha.gatilho),
      atividades: lista(linha.etapas).filter((item) => str(item.atividade)).slice(0, 40)
        .map((item) => ({ atividade: str(item.atividade), responsavel: str(item.responsavel), ferramenta: str(item.ferramentaDocumento) })),
      entradas: lista(linha.entradas).slice(0, 20).map((item) => ({ fornecedor: str(item.fornecedor), entrada: str(item.entrada) })),
      saidas: lista(linha.saidas).slice(0, 20).map((item) => ({ saida: str(item.saida), cliente: str(item.cliente) })),
      diagnostico: diagnostico?.resumo ?? "",
      maturidade: diagnostico?.maturidade.nivel ?? "",
      planoResumo: plano?.resumoToBe ?? "",
    };
  });
  contexto.conteudos = conteudos.map((linha) => ({ documentoId: str(linha.id), texto: str(linha.content_markdown).slice(0, MAX_CONTEUDO_DOCUMENTO) }));
  return contexto;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client, user } = await authenticateRequest(req);
    const body = await req.json();
    const companyId = requireString(body?.company_id, "company_id");
    await authorizeCompany(client, user.id, companyId);

    // Word, PDF e imagem chegam lidos pelo navegador: texto extraído ou imagem em data URL.
    const anexos = validarAnexosChat(body?.anexos);
    const mensagem = (typeof body?.mensagem === "string" ? body.mensagem.trim() : "") || (anexos.length ? "Analise o anexo." : "");
    if (!mensagem) throw new HttpError(400, "Mensagem vazia.");
    if (mensagem.length > MAX_MENSAGEM_CHAT) throw new HttpError(400, "Mensagem excede 4.000 caracteres.");
    if (checkModeration(mensagem).blocked) throw new HttpError(422, "Conteúdo inapropriado. Use linguagem profissional.");

    // A conversa precisa ser do próprio usuário e da empresa ativa (as regras de acesso garantem o resto).
    let conversaId = typeof body?.conversa_id === "string" && body.conversa_id.trim() ? body.conversa_id.trim() : null;
    let historico: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (conversaId) {
      const { data: conversa, error } = await client.from("peter_conversas").select("id, company_id").eq("id", conversaId).maybeSingle();
      if (error) throw error;
      if (!conversa || conversa.company_id !== companyId) throw new HttpError(404, "Conversa não encontrada.");
      const { data: anteriores, error: erroHistorico } = await client
        .from("peter_mensagens").select("role, conteudo, extras").eq("conversa_id", conversaId)
        .order("created_at", { ascending: false }).limit(MAX_HISTORICO_CHAT);
      if (erroHistorico) throw erroHistorico;
      historico = sanitizarHistoricoChat([...(anteriores ?? [])].reverse());
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurado");

    const persona = await carregarPersonaPeter(client, companyId);
    const busca = [...historico.filter((item) => item.role === "user").slice(-2).map((item) => item.content), mensagem].join(" ");
    const contexto = await montarContexto(client, companyId, busca);
    const primeiraResposta = !historico.some((item) => item.role === "assistant");

    const quotaLease = await acquireAiQuota(client, "ai-peter-chat", companyId);
    const sistema = promptChat(persona, contexto, primeiraResposta);
    const consumo = sistema.length + JSON.stringify(historico).length + mensagem.length
      + anexos.reduce((total, anexo) => total + (anexo.texto?.length ?? 0) + (anexo.imagem ? 4_000 : 0), 0);
    let resposta;
    try {
      const raw = await callResponsesAPI({
        systemPrompt: sistema,
        messages: [...historico, { role: "user", content: partesDaMensagem(mensagem, anexos) }],
        responseSchema: SCHEMA_CHAT,
        openaiApiKey: OPENAI_API_KEY,
      });
      resposta = lerRespostaChat(raw, contexto);
    } finally {
      await quotaLease.complete(consumo, Math.max(1, Math.ceil(consumo / 200)));
    }

    // Só grava depois da resposta, para uma falha não deixar pergunta sem resposta na conversa.
    let conversaNova = false;
    if (!conversaId) {
      const { data: nova, error } = await client.from("peter_conversas")
        .insert({ company_id: companyId, user_id: user.id, titulo: tituloDaConversa(mensagem) }).select("id").single();
      if (error) throw error;
      conversaId = nova.id as string;
      conversaNova = true;
    }
    const { data: gravadas, error: erroGravar } = await client.from("peter_mensagens").insert([
      // As duas linhas com as mesmas colunas: numa inserção múltipla, coluna ausente vira null.
      { conversa_id: conversaId, user_id: user.id, role: "user", conteudo: mensagem, extras: anexos.length ? { anexos: anexosParaGuardar(anexos) } : {} },
      { conversa_id: conversaId, user_id: user.id, role: "assistant", conteudo: resposta.resposta, extras: { atalhos: resposta.atalhos, convite: resposta.convite } },
    ]).select("*");
    if (erroGravar) {
      // Sem as mensagens, a conversa recém-criada ficaria vazia na lista.
      if (conversaNova) await client.from("peter_conversas").delete().eq("id", conversaId);
      throw erroGravar;
    }

    return new Response(JSON.stringify({ conversa_id: conversaId, mensagens: gravadas ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return errorResponse(e, corsHeaders);
  }
});
