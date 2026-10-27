import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const interviewSource = readFileSync(resolve("src/pages/EntrevistaProcesso.tsx"), "utf8");
const processListSource = readFileSync(resolve("src/pages/Processos.tsx"), "utf8");
const processMappingSource = readFileSync(resolve("src/lib/processos.ts"), "utf8");
const appSource = readFileSync(resolve("src/App.tsx"), "utf8");

describe("guided interview draft contract", () => {
  it("persists the form, the messages and the script state after each turn", () => {
    expect(interviewSource).toContain("void persistir(proximoForm, proximasMensagens, turno.estado)");
    expect(interviewSource).toContain("entrevistaRoteiro: estadoAtual");
    expect(interviewSource).toContain("saveQueueRef.current = tarefa.then(");
    expect(processMappingSource).toContain("entrevista_roteiro: entrevistaRoteiro as Json");
  });

  it("only writes the script state when it is provided", () => {
    expect(processMappingSource).toContain("...(entrevistaRoteiro !== undefined ? { entrevista_roteiro: entrevistaRoteiro as Json } : {})");
  });

  it("restores the form, the messages and the script state from a persisted process", () => {
    expect(interviewSource).toContain('supabase.from("processos").select("*").eq("id", processIdRef.current).single()');
    expect(interviewSource).toContain("mapProcessRowToForm(row)");
    expect(interviewSource).toContain("sanitizarEstado(ROTEIRO_PADRAO, row.entrevista_roteiro)");
    expect(interviewSource).toContain("restaurarMensagens(row.interview_messages)");
    expect(appSource).toContain('path="/processos/:id/entrevista"');
  });

  it("maps identification fields between the form and the table", () => {
    expect(processMappingSource).toContain("nome: form.nomeProcesso");
    expect(processMappingSource).toContain("area: form.area");
    expect(processMappingSource).toContain("responsavel: form.donoProcesso");
    expect(processMappingSource).toContain("nome: row.nome");
    expect(processMappingSource).toContain("area: row.area");
    expect(processMappingSource).toContain("responsavel: row.responsavel");
  });

  it("warns before leaving with unsaved data or a pending request", () => {
    expect(interviewSource).toContain('window.addEventListener("beforeunload", beforeUnload)');
    expect(interviewSource).toContain("Há informações que ainda não foram salvas");
  });

  it("exposes save state and a resume action", () => {
    expect(interviewSource).toContain('"Salvando…"');
    expect(interviewSource).toContain('"Falha ao salvar"');
    expect(interviewSource).toContain('"Salvo"');
    expect(processListSource).toContain('title="Retomar entrevista"');
  });

  it("keeps guided interview as the only new-process entry point", () => {
    expect(processListSource).toContain("Novo Processo");
    expect(processListSource).toContain('navigate("/processos/novo/entrevista", { state: { guidedExperience: true } })');
    expect(processListSource).not.toContain('navigate("/processos/novo")');
    expect(appSource).toContain('path="/processos/novo" element={<Navigate to="/processos/novo/entrevista"');
    expect(appSource).toContain('path="/processos/novo/formulario" element={<Navigate to="/processos/novo/entrevista"');
  });
});
