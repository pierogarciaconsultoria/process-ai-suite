import { useEffect, useState } from "react";

// Empresa ativa: fica no navegador e, ao mudar, avisa o layout para recarregar a tela aberta.
const CHAVE_ID = "process:activeEmpresaId";
const CHAVE_NOME = "process:activeEmpresaNome";
export const EVENTO_EMPRESA_ATIVA = "peter:empresa-ativa";

export function lerEmpresaAtiva(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_ID);
  } catch {
    return null;
  }
}

export function trocarEmpresaAtiva(id: string, nome = ""): void {
  try {
    window.localStorage.setItem(CHAVE_ID, id);
    window.localStorage.setItem(CHAVE_NOME, nome);
  } catch {
    // Sem acesso ao armazenamento local: a troca vale só para esta tela.
  }
  window.dispatchEvent(new CustomEvent(EVENTO_EMPRESA_ATIVA, { detail: id }));
}

export function useEmpresaAtiva(): string | null {
  const [id, setId] = useState(lerEmpresaAtiva);
  useEffect(() => {
    const atualizar = () => setId(lerEmpresaAtiva());
    window.addEventListener(EVENTO_EMPRESA_ATIVA, atualizar);
    return () => window.removeEventListener(EVENTO_EMPRESA_ATIVA, atualizar);
  }, []);
  return id;
}
