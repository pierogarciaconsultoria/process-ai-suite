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
