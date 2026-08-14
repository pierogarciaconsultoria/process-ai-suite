/**
 * Processamento de arquivos da entrevista do Peter.
 * Suporta PDF, DOCX, TXT e CSV. Imagens dependem de confirmação real do Assistant.
 * DOC legado, Excel, PowerPoint e PDF digitalizado não são suportados nesta camada.
 */
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import type { ArquivoProcessado } from "../../supabase/functions/_shared/peter-interview-contract";
import {
  LIMITE_TEXTO_CHARS,
  TAMANHO_MAX_IMAGEM_BASE64_CHARS,
  TIPOS_ACEITOS_MIME,
  TIPOS_IMAGEM,
  TIPOS_PDF,
  TIPOS_TEXTO,
  TIPOS_WORD,
} from "../../supabase/functions/_shared/peter-interview-contract";

export async function fileParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || "").split(",")[1];
      if (!base64) reject(new Error(`Base64 vazio para ${file.name}`));
      else resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Erro ao ler ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function extrairTextoPdf(file: File): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      const text = content.items.map((item: unknown) => {
        const record = item as { str?: unknown };
        return typeof record.str === "string" ? record.str : "";
      }).filter(Boolean).join(" ");
      pages.push(`[Página ${index}]\n${text}`);
    }
    const finalText = pages.join("\n\n").trim();
    if (!finalText || !pages.some((page) => page.replace(/^\[Página \d+\]\s*/, "").trim())) {
      throw new Error(`Nenhum texto encontrado em "${file.name}". PDFs digitalizados não são suportados — use texto no chat.`);
    }
    return finalText;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Nenhum texto")) throw error;
    throw new Error(`Não foi possível extrair o conteúdo de "${file.name}". O PDF pode estar protegido ou digitalizado. Cole o conteúdo relevante no chat.`);
  }
}

export async function extrairTextoDocx(file: File): Promise<string> {
  try {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const finalText = String(result.value || "").trim();
    if (!finalText) throw new Error(`Nenhum texto encontrado em "${file.name}".`);
    return finalText;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Nenhum texto")) throw error;
    throw new Error(`Não foi possível extrair o conteúdo de "${file.name}". Verifique se o arquivo não está corrompido.`);
  }
}

export async function extrairTextoPlano(file: File): Promise<string> {
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Erro ao ler ${file.name}`));
    reader.readAsText(file);
  });
  // Parser CSV simplificado: não interpreta campos com aspas e vírgulas internas.
  return file.type === "text/csv"
    ? text.split("\n").map((line) => line.split(",").join(" | ")).join("\n")
    : text;
}

export function detectarTipoConteudo(texto: string): "pop" | "processo" | "generico" {
  const text = texto.toLowerCase();
  if (text.includes("procedimento operacional") || text.includes("instrução de trabalho") || (text.includes("revisão") && text.includes("aprovado por"))) return "pop";
  if (text.includes("fluxo") || (text.includes("atividade") && text.includes("responsável")) || text.includes("processo")) return "processo";
  return "generico";
}

function textoProcessado(file: File, tipoLabel: string, text: string) {
  const truncado = text.length > LIMITE_TEXTO_CHARS;
  return {
    arquivo: {
      nome: file.name,
      tipo: file.type,
      tipoLabel,
      tamanhoBytes: file.size,
      textoExtraido: truncado ? text.substring(0, LIMITE_TEXTO_CHARS) : text,
      modoEnvio: "texto_extraido" as const,
      truncado,
      tamanhoTextoOriginal: truncado ? text.length : undefined,
    },
    avisoTruncamento: truncado,
  };
}

export async function processarArquivo(file: File): Promise<{ arquivo: ArquivoProcessado; avisoTruncamento: boolean }> {
  const tipoLabel = TIPOS_ACEITOS_MIME[file.type] ?? file.type;
  if (TIPOS_IMAGEM.includes(file.type)) {
    const base64 = await fileParaBase64(file);
    if (base64.length > TAMANHO_MAX_IMAGEM_BASE64_CHARS) throw new Error(`A imagem "${file.name}" é grande demais. Reduza a resolução e tente novamente.`);
    return { arquivo: { nome: file.name, tipo: file.type, tipoLabel, tamanhoBytes: file.size, base64, modoEnvio: "image_url", truncado: false }, avisoTruncamento: false };
  }
  if (TIPOS_PDF.includes(file.type)) return textoProcessado(file, tipoLabel, await extrairTextoPdf(file));
  if (TIPOS_WORD.includes(file.type)) return textoProcessado(file, tipoLabel, await extrairTextoDocx(file));
  if (TIPOS_TEXTO.includes(file.type)) return textoProcessado(file, tipoLabel, await extrairTextoPlano(file));
  throw new Error(`Tipo não suportado após validação: ${file.type}`);
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "high" } };

export function montarContentParaThread(arquivos: ArquivoProcessado[], etapaAtual: number): ContentPart[] {
  const parts: ContentPart[] = [];
  for (const file of arquivos) {
    if (file.modoEnvio === "image_url" && file.base64) {
      parts.push({ type: "image_url", image_url: { url: `data:${file.tipo};base64,${file.base64}`, detail: "high" } });
    } else if (file.modoEnvio === "texto_extraido" && file.textoExtraido) {
      const prefix = detectarTipoConteudo(file.textoExtraido) === "pop"
        ? `[Procedimento existente: "${file.nome}" — confirme se ainda reflete como o processo funciona hoje]`
        : `[${file.tipoLabel}: "${file.nome}"]`;
      const truncation = file.truncado ? `\n[Nota: texto truncado em ${LIMITE_TEXTO_CHARS.toLocaleString()} caracteres${file.tamanhoTextoOriginal ? ` de ${file.tamanhoTextoOriginal.toLocaleString()} originais` : ""}]` : "";
      parts.push({ type: "text", text: `${prefix}${truncation}\n${file.textoExtraido}` });
    }
  }
  const names = arquivos.map((file) => `"${file.nome}"`).join(", ");
  const instruction = arquivos.length > 1 ? `Recebi ${arquivos.length} arquivos: ${names}.` : `Recebi o arquivo ${names}.`;
  parts.push({
    type: "text",
    text: `${instruction} Estamos na Etapa ${etapaAtual} de 6. Extraia as informações seguindo a tabela por etapa. Em partialUpdate, inclua todos os campos identificados. Em nextQuestion, apresente um resumo conciso (máximo 3 linhas) seguido de até duas perguntas sobre as principais lacunas. Não inclua base64 nem conteúdo bruto do arquivo em nextQuestion.`,
  });
  return parts;
}

export function labelVisualArquivos(arquivos: ArquivoProcessado[]): string {
  if (arquivos.length === 1) {
    const file = arquivos[0];
    return `📎 ${file.nome} (${file.tipoLabel})${file.truncado ? " ⚠️ truncado" : ""}`;
  }
  return `📎 ${arquivos.length} arquivos: ${arquivos.map((file) => `${file.nome}${file.truncado ? " ⚠️" : ""}`).join(", ")}`;
}
