// Quebra o markdown simples das respostas do Peter em parágrafos, títulos e listas.
export type Bloco = { tipo: "p" | "titulo"; texto: string } | { tipo: "ul" | "ol"; itens: string[] };

export function blocosDoMarkdown(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  let paragrafo: string[] = [];
  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push({ tipo: "p", texto: paragrafo.join(" ") });
    paragrafo = [];
  };
  for (const bruta of texto.replace(/\r/g, "").split("\n")) {
    const linha = bruta.trim();
    const marcador = linha.match(/^[-*•]\s+(.*)$/);
    const numero = linha.match(/^\d+[.)]\s+(.*)$/);
    const titulo = linha.match(/^#{1,6}\s+(.*)$/);
    if (!linha) {
      fecharParagrafo();
    } else if (titulo) {
      fecharParagrafo();
      blocos.push({ tipo: "titulo", texto: titulo[1] });
    } else if (marcador || numero) {
      fecharParagrafo();
      const tipo = marcador ? "ul" : "ol";
      const item = (marcador ?? numero)![1];
      const ultimo = blocos[blocos.length - 1];
      if (ultimo && ultimo.tipo === tipo) ultimo.itens.push(item);
      else blocos.push({ tipo, itens: [item] });
    } else {
      paragrafo.push(linha);
    }
  }
  fecharParagrafo();
  return blocos;
}
