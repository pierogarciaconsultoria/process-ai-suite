export type ModoEntrada = "nenhum" | "entrevista" | "texto_livre" | "anexo" | "misto";

export type InterviewStage = "selectMode" | "askUserName" | "askProcessName" | "askArea" | "askProcessOwner" | "awaitContent" | "aiFlow";

export interface InterviewResponse {
  raciocinio?: string;
  avaliacao_comportamento?: string;
  avaliacao_conteudo?: string;
  isValid?: boolean;
  nextQuestion?: string;
  partialUpdate?: Record<string, unknown>;
  done?: boolean;
  etapa_atual?: number;
  etapa_confirmada?: boolean;
  avancar_etapa?: boolean;
  alerta?: string | null;
  oportunidade?: string | null;
}

export interface MetadadosEntrevista {
  _tipo: "metadados_peter_v5";
  etapa_atual: number;
  modo_entrada: ModoEntrada;
  aguardando_confirmacao: boolean;
  stage: InterviewStage;
  conteudo_pendente: string;
  atualizado_em: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  _eh_metadado?: boolean;
}

const MODOS: ModoEntrada[] = ["nenhum", "entrevista", "texto_livre", "anexo", "misto"];
const STAGES: InterviewStage[] = ["selectMode", "askUserName", "askProcessName", "askArea", "askProcessOwner", "awaitContent", "aiFlow"];

export function clampEtapa(value: unknown, fallback: number): number {
  const safeFallback = typeof fallback === "number" && Number.isFinite(fallback) ? Math.trunc(fallback) : 1;
  const n = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : safeFallback;
  return Math.min(6, Math.max(1, n));
}

export function normalizarResposta(
  raw: unknown,
  etapaAtualCliente: number,
  aguardandoConfirmacaoCliente: boolean,
): InterviewResponse {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const etapaCliente = clampEtapa(etapaAtualCliente, 1);
  const etapaFinal = Math.min(
    Math.max(clampEtapa(r.etapa_atual, etapaCliente), etapaCliente),
    Math.min(6, etapaCliente + 1),
  );
  const etapaConfirmada = r.etapa_confirmada === true && aguardandoConfirmacaoCliente;
  const done = r.done === true && etapaCliente === 6 && aguardandoConfirmacaoCliente && etapaConfirmada;

  return {
    raciocinio: typeof r.raciocinio === "string" ? r.raciocinio : "",
    avaliacao_comportamento: typeof r.avaliacao_comportamento === "string" ? r.avaliacao_comportamento : "",
    avaliacao_conteudo: typeof r.avaliacao_conteudo === "string" ? r.avaliacao_conteudo : "",
    isValid: typeof r.isValid === "boolean" ? r.isValid : true,
    nextQuestion: typeof r.nextQuestion === "string" ? r.nextQuestion : "",
    partialUpdate: r.partialUpdate && typeof r.partialUpdate === "object" && !Array.isArray(r.partialUpdate)
      ? r.partialUpdate as Record<string, unknown>
      : {},
    done,
    etapa_atual: etapaFinal,
    etapa_confirmada: etapaConfirmada,
    avancar_etapa: r.avancar_etapa === true,
    alerta: typeof r.alerta === "string" ? r.alerta : null,
    oportunidade: typeof r.oportunidade === "string" ? r.oportunidade : null,
  };
}

export function criarMensagemMetadados(meta: MetadadosEntrevista): ChatMessage {
  return { role: "system", content: JSON.stringify(meta), _eh_metadado: true };
}

export function restaurarMetadados(mensagens: ChatMessage[]): MetadadosEntrevista | null {
  const message = mensagens.find((item) => item._eh_metadado === true);
  if (!message) return null;
  try {
    const raw = JSON.parse(message.content) as Record<string, unknown>;
    if (
      raw._tipo !== "metadados_peter_v5" ||
      typeof raw.etapa_atual !== "number" ||
      !Number.isInteger(raw.etapa_atual) ||
      raw.etapa_atual < 1 || raw.etapa_atual > 6 ||
      !MODOS.includes(raw.modo_entrada as ModoEntrada) ||
      !STAGES.includes(raw.stage as InterviewStage) ||
      typeof raw.aguardando_confirmacao !== "boolean" ||
      typeof raw.conteudo_pendente !== "string" ||
      typeof raw.atualizado_em !== "string"
    ) return null;
    return raw as unknown as MetadadosEntrevista;
  } catch {
    return null;
  }
}

// ─── Upload — Camada 3 ──────────────────────────────────────────────────────

export type ModoEnvioArquivo = "image_url" | "texto_extraido";

export interface ArquivoProcessado {
  nome: string;
  tipo: string;
  tipoLabel: string;
  tamanhoBytes: number;
  base64?: string;
  textoExtraido?: string;
  modoEnvio: ModoEnvioArquivo;
  truncado: boolean;
  tamanhoTextoOriginal?: number;
}

export interface ValidacaoArquivo {
  valido: boolean;
  erro?: string;
}

export const TIPOS_ACEITOS_MIME: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word (DOCX)",
  "text/plain": "Texto (TXT)",
  "text/csv": "CSV",
  "image/png": "Imagem (PNG)",
  "image/jpeg": "Imagem (JPG)",
  "image/jpg": "Imagem (JPG)",
};

export const EXTENSOES_ACEITAS = ".pdf,.docx,.txt,.csv";
export const TAMANHO_MAX_POR_ARQUIVO_BYTES = 10 * 1024 * 1024;
export const TAMANHO_MAX_LOTE_BYTES = 15 * 1024 * 1024;
export const TAMANHO_MAX_IMAGEM_BASE64_CHARS = 7_000_000;
export const LIMITE_TEXTO_CHARS = 16_000;
export const MAX_ARQUIVOS_POR_LOTE = 10;

export const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/jpg"];
export const TIPOS_PDF = ["application/pdf"];
export const TIPOS_WORD = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
export const TIPOS_TEXTO = ["text/plain", "text/csv"];

// Mantido false até o teste real obrigatório confirmar data URL no Assistant configurado.
export const IMAGENS_ASSISTANT_CONFIRMADAS = false;

export function validarArquivo(file: File): ValidacaoArquivo {
  if (!Object.keys(TIPOS_ACEITOS_MIME).includes(file.type)) {
    const name = file.name.toLowerCase();
    if (file.type === "application/msword" || name.endsWith(".doc")) {
      return { valido: false, erro: "Formato DOC não suportado. Salve o arquivo como DOCX e tente novamente." };
    }
    if (file.type.includes("excel") || file.type.includes("spreadsheet") || /\.(xls|xlsx)$/i.test(name)) {
      return { valido: false, erro: "Excel ainda não é suportado. Cole o conteúdo da planilha diretamente no chat." };
    }
    if (file.type.includes("powerpoint") || file.type.includes("presentation") || /\.(ppt|pptx)$/i.test(name)) {
      return { valido: false, erro: "PowerPoint ainda não é suportado. Descreva os slides relevantes no chat." };
    }
    return { valido: false, erro: `Formato não suportado: "${file.name}". Aceitos: PDF, DOCX, TXT e CSV.` };
  }
  if (TIPOS_IMAGEM.includes(file.type) && !IMAGENS_ASSISTANT_CONFIRMADAS) {
    return {
      valido: false,
      erro: "Imagens serão suportadas em breve. Por enquanto, descreva o fluxograma no chat ou exporte o processo como PDF.",
    };
  }
  if (file.size > TAMANHO_MAX_POR_ARQUIVO_BYTES) {
    return { valido: false, erro: `"${file.name}" é grande demais (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: 10MB por arquivo.` };
  }
  if (file.size === 0) return { valido: false, erro: `O arquivo "${file.name}" está vazio.` };
  return { valido: true };
}

export function validarLote(arquivos: File[]): ValidacaoArquivo {
  if (arquivos.length > MAX_ARQUIVOS_POR_LOTE) {
    return { valido: false, erro: `Máximo de ${MAX_ARQUIVOS_POR_LOTE} arquivos por envio.` };
  }
  const total = arquivos.reduce((sum, file) => sum + file.size, 0);
  if (total > TAMANHO_MAX_LOTE_BYTES) {
    return { valido: false, erro: `Tamanho total (${(total / 1024 / 1024).toFixed(1)}MB) excede 15MB. Reduza a quantidade ou o tamanho.` };
  }
  return { valido: true };
}
