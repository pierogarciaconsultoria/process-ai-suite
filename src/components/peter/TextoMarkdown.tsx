import React from "react";
import { blocosDoMarkdown } from "@/lib/markdown-simples";

// Markdown simples das respostas do Peter: parágrafos, listas, títulos e **negrito**.
// Tudo vira texto do React, sem HTML vindo da resposta.
function Negrito({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*\*[^*]+\*\*)/g).map((parte, indice) =>
        parte.startsWith("**") && parte.endsWith("**") && parte.length > 4
          ? <strong key={indice}>{parte.slice(2, -2)}</strong>
          : <React.Fragment key={indice}>{parte}</React.Fragment>,
      )}
    </>
  );
}

export function TextoMarkdown({ texto }: { texto: string }) {
  return (
    <div className="space-y-2">
      {blocosDoMarkdown(texto).map((bloco, indice) => {
        if (!("itens" in bloco)) {
          return <p key={indice} className={bloco.tipo === "titulo" ? "font-semibold" : ""}><Negrito texto={bloco.texto} /></p>;
        }
        const Lista = bloco.tipo === "ul" ? "ul" : "ol";
        return (
          <Lista key={indice} className={`space-y-1 pl-5 ${bloco.tipo === "ul" ? "list-disc" : "list-decimal"}`}>
            {bloco.itens.map((item, posicao) => <li key={posicao}><Negrito texto={item} /></li>)}
          </Lista>
        );
      })}
    </div>
  );
}
