import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  EntradaForm,
  EtapaForm,
  IndicadorForm,
  PlanoAcao5W2H,
  ProcessoFormData,
  SaidaForm,
} from "@/data/processo-form-types";
import type { AcaoIA } from "../../supabase/functions/_shared/roteiro-entrevista";
import type { EstadoRoteiro } from "../../supabase/functions/_shared/roteiro-engine";
import type { CamposExtraidos, ResultadoTurno } from "../../supabase/functions/_shared/roteiro-peter";

export type TipoMensagem = "alerta" | "oportunidade" | "analise";

export interface MensagemEntrevista {
  role: "user" | "assistant";
  content: string;
  tipo?: TipoMensagem;
  // Em mensagens de análise, content guarda o JSON da versão exibida.
  acao?: AcaoIA;
}

export type OperacaoRoteiro = "responder" | "extrair" | "analisar";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function registros(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

// Aplica os campos devolvidos pelo Peter ao formulário. O Peter devolve o valor
// completo de cada campo, então listas são substituídas e não concatenadas.
export function mesclarCampos(form: ProcessoFormData, campos: CamposExtraidos): ProcessoFormData {
  const proximo = { ...form };
  for (const [campo, valor] of Object.entries(campos)) {
    switch (campo) {
      case "etapas":
        proximo.etapas = registros(valor).map((item, indice): EtapaForm => ({
          ordem: indice + 1,
          atividade: str(item.atividade),
          responsavel: str(item.responsavel),
          ferramentaDocumento: str(item.ferramentaDocumento),
        }));
        break;
      case "entradas":
        proximo.entradas = registros(valor).map((item): EntradaForm => ({ fornecedor: str(item.fornecedor), entrada: str(item.entrada) }));
        break;
      case "saidas":
        proximo.saidas = registros(valor).map((item): SaidaForm => ({ saida: str(item.saida), cliente: str(item.cliente) }));
        break;
      case "indicadores":
        proximo.indicadores = registros(valor).map((item): IndicadorForm => ({
          nome: str(item.nome),
          objetivo: str(item.objetivo),
          formulaCalculo: str(item.formulaCalculo),
          meta: str(item.meta),
          periodicidade: str(item.periodicidade),
          responsavel: str(item.responsavel),
        }));
        break;
      case "planoAcao":
        proximo.planoAcao = registros(valor).map((item): PlanoAcao5W2H => ({
          oque: str(item.oque),
          porque: str(item.porque),
          quem: str(item.quem),
          quando: str(item.quando),
          onde: str(item.onde),
          como: str(item.como),
          custo: str(item.custo),
        }));
        break;
      case "problemas":
        if (isRecord(valor)) {
          proximo.problemas = Object.fromEntries(
            Object.entries(form.problemas).map(([chave, atual]) => [chave, typeof valor[chave] === "boolean" ? valor[chave] : atual]),
          ) as ProcessoFormData["problemas"];
        }
        break;
      case "classificacao":
        if (valor === "Negócio" || valor === "Apoio" || valor === "Gestão") proximo.classificacao = valor;
        break;
      default:
        if (typeof valor === "string" && campo in form) (proximo as Record<string, unknown>)[campo] = valor;
    }
  }
  return proximo;
}

// Mensagens que o turno acrescenta ao chat, na ordem de exibição.
export function mensagensDoTurno(turno: ResultadoTurno): MensagemEntrevista[] {
  const mensagens: MensagemEntrevista[] = [];
  if (turno.analise) {
    mensagens.push({ role: "assistant", tipo: "analise", acao: turno.analise, content: JSON.stringify(turno.estado.analises[turno.analise] ?? null) });
  }
  if (turno.alerta) mensagens.push({ role: "assistant", tipo: "alerta", content: turno.alerta });
  if (turno.oportunidade) mensagens.push({ role: "assistant", tipo: "oportunidade", content: turno.oportunidade });
  if (turno.mensagem.trim()) mensagens.push({ role: "assistant", content: turno.mensagem });
  return mensagens;
}

// Histórico enviado ao Peter: só a conversa, sem cartões de análise e avisos.
export function historicoParaPeter(mensagens: MensagemEntrevista[]): Array<{ role: "user" | "assistant"; content: string }> {
  return mensagens.filter((mensagem) => !mensagem.tipo).map(({ role, content }) => ({ role, content }));
}

export function restaurarMensagens(raw: Json | null | undefined): MensagemEntrevista[] {
  return registros(raw)
    .filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
    .map((item) => ({
      role: item.role as MensagemEntrevista["role"],
      content: item.content as string,
      ...(item.tipo === "alerta" || item.tipo === "oportunidade" || item.tipo === "analise" ? { tipo: item.tipo } : {}),
      ...(item.acao === "diagnostico_as_is" || item.acao === "plano_melhoria" ? { acao: item.acao } : {}),
    }));
}

async function mensagemDeErro(error: unknown): Promise<string> {
  const contexto = isRecord(error) ? error.context : null;
  if (contexto instanceof Response) {
    try {
      const corpo = await contexto.json();
      if (isRecord(corpo) && typeof corpo.error === "string") return corpo.error;
    } catch {
      // Corpo não é JSON: usa a mensagem genérica abaixo.
    }
  }
  return "Não consegui falar com o Peter agora. Verifique sua conexão e tente novamente.";
}

export async function chamarRoteiro(body: {
  operacao: OperacaoRoteiro;
  company_id: string;
  process_id: string | null;
  estado: EstadoRoteiro;
  resposta?: string;
  current?: ProcessoFormData;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  origem?: "texto_livre" | "anexo";
  arquivo_content?: unknown[];
}): Promise<ResultadoTurno> {
  const { data, error } = await supabase.functions.invoke("ai-interview-roteiro", { body });
  if (error) throw new Error(await mensagemDeErro(error));
  if (isRecord(data) && typeof data.error === "string") throw new Error(data.error);
  return data as ResultadoTurno;
}
