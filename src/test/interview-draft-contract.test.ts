import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const interviewSource = readFileSync(resolve("src/pages/EntrevistaProcesso.tsx"), "utf8");
const processListSource = readFileSync(resolve("src/pages/Processos.tsx"), "utf8");
const appSource = readFileSync(resolve("src/App.tsx"), "utf8");

describe("guided interview draft contract", () => {
  it("persists interview snapshots after user responses", () => {
    expect(interviewSource).toContain('messages.some((message) => message.role === "user")');
    expect(interviewSource).toContain("persistProcessDraft(snapshotForm, snapshotMessages, \"Rascunho\")");
    expect(interviewSource).toContain("saveQueueRef.current = saveQueueRef.current");
  });

  it("restores the form and message history from a persisted process", () => {
    expect(interviewSource).toContain('supabase.from("processos").select("*").eq("id", processId).single()');
    expect(interviewSource).toContain("mapProcessRowToForm(row)");
    expect(interviewSource).toContain("row.interview_messages");
    expect(appSource).toContain('path="/processos/:id/entrevista"');
  });

  it("warns before leaving with unsynchronized or unsent data", () => {
    expect(interviewSource).toContain('window.addEventListener("beforeunload", beforeUnload)');
    expect(interviewSource).toContain('window.addEventListener("popstate", handlePopState)');
    expect(interviewSource).toContain('document.addEventListener("click", captureLink, true)');
    expect(interviewSource).toContain("Há respostas que ainda não foram sincronizadas");
  });

  it("exposes save state and a resume action", () => {
    expect(interviewSource).toContain('"Salvando…"');
    expect(interviewSource).toContain('"Falha ao salvar"');
    expect(interviewSource).toContain('"Salvo"');
    expect(processListSource).toContain('title="Retomar entrevista"');
  });
});
