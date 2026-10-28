/**
 * Processamento de arquivos da entrevista do Peter.
 * Suporta PDF (inclusive digitalizado via OCR), DOCX, TXT, CSV, diagramas BPMN 2.0
 * (convertidos em texto) e imagens PNG/JPG (enviadas ao Peter como imagem).
 * DOC legado, Excel e PowerPoint não são suportados.
 */
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import type { ArquivoProcessado } from "../../supabase/functions/_shared/peter-interview-contract";
import {
  LIMITE_TEXTO_CHARS,
  TIPO_LABEL_BPMN,
  TAMANHO_MAX_IMAGEM_BASE64_CHARS,
  TIPOS_ACEITOS_MIME,
  TIPOS_IMAGEM,
  TIPOS_PDF,
  TIPOS_TEXTO,
  TIPOS_WORD,
  ehArquivoBpmn,
} from "../../supabase/functions/_shared/peter-interview-contract";
import { bpmnParaTexto, temDesenhoBpmn } from "./peter-bpmn";

// Erro com mensagem pronta para o usuário: chega à tela sem ser trocado pelo genérico.
class ErroLeituraArquivo extends Error {}

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
    const hasSelectableText = Boolean(finalText) && pages.some((page) => page.replace(/^\[Página \d+\]\s*/, "").trim().length > 0);
    if (!hasSelectableText) {
      console.warn(`[Peter upload] PDF.js não encontrou texto selecionável em "${file.name}"; iniciando OCR.`);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["por", "eng"]);
      const ocrPages: string[] = [];
      try {
        for (let index = 1; index <= pdf.numPages; index += 1) {
          const page = await pdf.getPage(index);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) throw new Error("Canvas indisponível para OCR.");
          await page.render({ canvasContext: context, viewport }).promise;
          const result = await worker.recognize(canvas);
          const pageText = String(result.data.text || "").trim();
          if (pageText) ocrPages.push(`[Página ${index} — OCR]\n${pageText}`);
          canvas.width = 0;
          canvas.height = 0;
          if (ocrPages.join("\n\n").length >= LIMITE_TEXTO_CHARS) break;
        }
      } finally {
        await worker.terminate();
      }
      const ocrText = ocrPages.join("\n\n").trim();
      if (!ocrText) {
        throw new ErroLeituraArquivo(`O PDF "${file.name}" não contém texto selecionável e o OCR não encontrou conteúdo legível. Tente outra cópia com melhor resolução ou cole o conteúdo no chat.`);
      }
      console.info(`[Peter upload] OCR extraiu ${ocrText.length} caracteres de "${file.name}".`);
      return ocrText;
    }
    console.info(`[Peter upload] PDF.js extraiu ${finalText.length} caracteres de "${file.name}".`);
    return finalText;
  } catch (error) {
    if (error instanceof ErroLeituraArquivo) throw error;
    throw new Error(`Não foi possível extrair o conteúdo de "${file.name}". O PDF pode estar protegido ou corrompido. Tente outra cópia ou cole o conteúdo relevante no chat.`);
  }
}

export async function extrairTextoDocx(file: File): Promise<string> {
  try {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const finalText = String(result.value || "").trim();
    if (!finalText) throw new ErroLeituraArquivo(`Nenhum texto encontrado em "${file.name}".`);
    return finalText;
  } catch (error) {
    if (error instanceof ErroLeituraArquivo) throw error;
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

// Diagrama anexado que vira o mapa AS IS: o último .bpmn com desenho que não seja um TO BE.
export async function mapaAsIsDosAnexos(files: File[]): Promise<string | null> {
  for (const file of [...files].reverse()) {
    if (!ehArquivoBpmn(file) || /(^|[^a-z])to[\s_-]?be([^a-z]|$)/i.test(file.name)) continue;
    const xml = await extrairTextoPlano(file);
    if (temDesenhoBpmn(xml)) return xml;
  }
  return null;
}

export async function extrairTextoBpmn(file: File): Promise<string> {
  const convertido = bpmnParaTexto(await extrairTextoPlano(file));
  if (!convertido) {
    throw new ErroLeituraArquivo(`"${file.name}" não é um diagrama BPMN 2.0 válido. Exporte o processo da sua ferramenta no formato BPMN 2.0 (.bpmn) e tente novamente.`);
  }
  if (convertido.totalElementos === 0) throw new ErroLeituraArquivo(`O diagrama "${file.name}" não tem atividades nem eventos.`);
  return convertido.texto;
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

const TAMANHO_IMAGEM_SEM_REDUCAO_BYTES = 4 * 1024 * 1024;
const LADO_MAX_IMAGEM_PX = 2048;

// Fotos de celular passam fácil do limite de envio. Acima de 4MB, a imagem é
// redesenhada com no máximo 2048px no maior lado (a OpenAI reduz para isso de
// qualquer forma) e salva como JPEG.
async function imagemParaEnvio(file: File): Promise<File> {
  if (file.size <= TAMANHO_IMAGEM_SEM_REDUCAO_BYTES || typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ErroLeituraArquivo(`Não foi possível ler a imagem "${file.name}". Verifique se o arquivo não está corrompido.`);
  }
  try {
    const escala = Math.min(1, LADO_MAX_IMAGEM_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const context = canvas.getContext("2d");
    if (!context) return file;
    // JPEG não tem transparência: o fundo branco evita áreas pretas em PNGs.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name, { type: "image/jpeg" }) : file;
  } finally {
    bitmap.close();
  }
}

export async function processarArquivo(file: File): Promise<{ arquivo: ArquivoProcessado; avisoTruncamento: boolean }> {
  if (ehArquivoBpmn(file)) return textoProcessado(file, TIPO_LABEL_BPMN, await extrairTextoBpmn(file));
  const tipoLabel = TIPOS_ACEITOS_MIME[file.type] ?? file.type;
  if (TIPOS_IMAGEM.includes(file.type)) {
    const imagem = await imagemParaEnvio(file);
    const base64 = await fileParaBase64(imagem);
    if (base64.length > TAMANHO_MAX_IMAGEM_BASE64_CHARS) throw new ErroLeituraArquivo(`A imagem "${file.name}" é grande demais. Reduza a resolução e tente novamente.`);
    return { arquivo: { nome: file.name, tipo: imagem.type, tipoLabel, tamanhoBytes: file.size, base64, modoEnvio: "image_url", truncado: false }, avisoTruncamento: false };
  }
  if (TIPOS_PDF.includes(file.type)) return textoProcessado(file, tipoLabel, await extrairTextoPdf(file));
  if (TIPOS_WORD.includes(file.type)) return textoProcessado(file, tipoLabel, await extrairTextoDocx(file));
  if (TIPOS_TEXTO.includes(file.type)) return textoProcessado(file, tipoLabel, await extrairTextoPlano(file));
  throw new Error(`Tipo não suportado após validação: ${file.type}`);
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "high" } };

// Partes dos arquivos para a extração do roteiro; as instruções vêm do prompt do servidor.
export function montarPartesArquivo(arquivos: ArquivoProcessado[]): ContentPart[] {
  const parts: ContentPart[] = [];
  for (const file of arquivos) {
    if (file.modoEnvio === "image_url" && file.base64) {
      parts.push({ type: "text", text: `[${file.tipoLabel}: "${file.nome}"]` });
      parts.push({ type: "image_url", image_url: { url: `data:${file.tipo};base64,${file.base64}`, detail: "high" } });
    } else if (file.modoEnvio === "texto_extraido" && file.textoExtraido) {
      const prefix = detectarTipoConteudo(file.textoExtraido) === "pop"
        ? `[Procedimento existente: "${file.nome}" — pode estar desatualizado em relação ao processo atual]`
        : `[${file.tipoLabel}: "${file.nome}"]`;
      const truncation = file.truncado ? `\n[Nota: texto truncado em ${LIMITE_TEXTO_CHARS.toLocaleString()} caracteres]` : "";
      parts.push({ type: "text", text: `${prefix}${truncation}\n${file.textoExtraido}` });
    }
  }
  return parts;
}

export function labelVisualArquivos(arquivos: ArquivoProcessado[]): string {
  if (arquivos.length === 1) {
    const file = arquivos[0];
    return `📎 ${file.nome} (${file.tipoLabel})${file.truncado ? " ⚠️ truncado" : ""}`;
  }
  return `📎 ${arquivos.length} arquivos: ${arquivos.map((file) => `${file.nome}${file.truncado ? " ⚠️" : ""}`).join(", ")}`;
}
