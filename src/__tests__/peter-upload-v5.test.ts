import { describe, expect, it } from "vitest";
import {
  EXTENSOES_ACEITAS,
  IMAGENS_ASSISTANT_CONFIRMADAS,
  LIMITE_TEXTO_CHARS,
  validarArquivo,
  validarLote,
  type ArquivoProcessado,
} from "../../supabase/functions/_shared/peter-interview-contract";
import {
  detectarTipoConteudo,
  labelVisualArquivos,
  montarPartesArquivo,
  processarArquivo,
} from "@/lib/peter-upload";

const makeFile = (content: string, name: string, type: string) => new File([content], name, { type });

describe("Peter v5 — upload", () => {
  it("valida formatos, tamanho, lote e mantém imagens desabilitadas sem teste real", () => {
    expect(validarArquivo(makeFile("pdf", "processo.pdf", "application/pdf")).valido).toBe(true);
    expect(validarArquivo(makeFile("x", "antigo.doc", "application/msword")).erro).toContain("DOCX");
    expect(validarArquivo(makeFile("x", "dados.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).erro).toContain("Excel");
    expect(validarArquivo(makeFile("x", "slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation")).erro).toContain("PowerPoint");
    expect(validarArquivo(makeFile("", "vazio.txt", "text/plain")).valido).toBe(false);
    expect(IMAGENS_ASSISTANT_CONFIRMADAS).toBe(false);
    expect(EXTENSOES_ACEITAS).toBe(".pdf,.docx,.txt,.csv");
    expect(validarArquivo(makeFile("png", "mapa.png", "image/png")).erro).toContain("em breve");
    expect(validarLote([]).valido).toBe(true);
    const large = new File([new Uint8Array(8 * 1024 * 1024)], "large.txt", { type: "text/plain" });
    expect(validarLote([large, large]).valido).toBe(false);
  });

  it("processa TXT e CSV e trunca somente quando excede o limite", async () => {
    const txt = await processarArquivo(makeFile("conteúdo", "nota.txt", "text/plain"));
    expect(txt.arquivo).toMatchObject({ modoEnvio: "texto_extraido", textoExtraido: "conteúdo", truncado: false });
    const csv = await processarArquivo(makeFile("a,b\n1,2", "dados.csv", "text/csv"));
    expect(csv.arquivo.textoExtraido).toBe("a | b\n1 | 2");
    const exact = await processarArquivo(makeFile("x".repeat(LIMITE_TEXTO_CHARS), "exact.txt", "text/plain"));
    expect(exact.arquivo.truncado).toBe(false);
    const long = await processarArquivo(makeFile("x".repeat(LIMITE_TEXTO_CHARS + 1), "long.txt", "text/plain"));
    expect(long.arquivo.truncado).toBe(true);
    expect(long.arquivo.textoExtraido).toHaveLength(LIMITE_TEXTO_CHARS);
    expect(long.arquivo.tamanhoTextoOriginal).toBe(LIMITE_TEXTO_CHARS + 1);
  });

  it("detecta procedimentos e monta as partes sem instruções embutidas", () => {
    expect(detectarTipoConteudo("Procedimento Operacional Padrão")).toBe("pop");
    expect(detectarTipoConteudo("atividade, responsável e fluxo")).toBe("processo");
    expect(detectarTipoConteudo("relatório trimestral")).toBe("generico");
    const file: ArquivoProcessado = {
      nome: "pop.txt", tipo: "text/plain", tipoLabel: "Texto (TXT)", tamanhoBytes: 10,
      textoExtraido: "Procedimento operacional", modoEnvio: "texto_extraido", truncado: false,
    };
    const parts = montarPartesArquivo([file]);
    expect(parts).toHaveLength(1);
    expect((parts[0] as { text: string }).text).toContain("Procedimento existente");
    expect((parts[0] as { text: string }).text).toContain("Procedimento operacional");
    expect(labelVisualArquivos([file])).toBe("📎 pop.txt (Texto (TXT))");
  });

  it("gera uma parte por arquivo", () => {
    const files: ArquivoProcessado[] = ["a.txt", "b.csv"].map((nome) => ({
      nome, tipo: "text/plain", tipoLabel: "Texto", tamanhoBytes: 1,
      textoExtraido: "processo", modoEnvio: "texto_extraido", truncado: false,
    }));
    expect(montarPartesArquivo(files)).toHaveLength(2);
    expect(labelVisualArquivos(files)).toContain("2 arquivos");
  });
});
