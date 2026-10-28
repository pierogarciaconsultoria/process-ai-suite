/**
 * Converte um diagrama BPMN 2.0 (.bpmn ou .xml exportado de Bizagi, Camunda,
 * bpmn.io, HEFLO etc.) em texto para a extração do Peter: elementos na ordem do
 * fluxo, responsáveis pelas raias, caminhos das decisões, documentos e anotações.
 * As coordenadas do desenho (BPMNDI) são descartadas.
 */

const NS_BPMN = "http://www.omg.org/spec/BPMN/20100524/MODEL";
const NS_BPMNDI = "http://www.omg.org/spec/BPMN/20100524/DI";

const ROTULO_ELEMENTO: Record<string, string> = {
  task: "Tarefa",
  userTask: "Tarefa de usuário",
  manualTask: "Tarefa manual",
  serviceTask: "Tarefa automática (sistema)",
  scriptTask: "Tarefa automática (script)",
  businessRuleTask: "Regra de negócio",
  sendTask: "Envio",
  receiveTask: "Recebimento",
  callActivity: "Chamada de outro processo",
  subProcess: "Subprocesso",
  adHocSubProcess: "Subprocesso",
  transaction: "Transação",
  startEvent: "Início",
  endEvent: "Fim",
  intermediateCatchEvent: "Evento intermediário (espera)",
  intermediateThrowEvent: "Evento intermediário (disparo)",
  boundaryEvent: "Evento de borda",
  exclusiveGateway: "Decisão",
  inclusiveGateway: "Decisão (um ou mais caminhos)",
  parallelGateway: "Divisão/junção em paralelo",
  eventBasedGateway: "Decisão por evento",
  complexGateway: "Decisão complexa",
};

const ROTULO_EVENTO: Record<string, string> = {
  messageEventDefinition: "mensagem",
  timerEventDefinition: "temporizador",
  conditionalEventDefinition: "condição",
  signalEventDefinition: "sinal",
  errorEventDefinition: "erro",
  escalationEventDefinition: "escalonamento",
  compensateEventDefinition: "compensação",
  terminateEventDefinition: "término",
  linkEventDefinition: "link",
  cancelEventDefinition: "cancelamento",
};

const LEGENDA = "Diagrama de processo em BPMN 2.0, convertido em texto. Os números indicam a ordem do fluxo; \"→\" indica para onde ele segue e, sem \"→\", segue para o item seguinte.";

export interface BpmnConvertido {
  texto: string;
  totalElementos: number;
}

function limpar(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\s+/g, " ").trim();
}

function nomeDe(elemento: Element | undefined): string {
  return limpar(elemento?.getAttribute("name"));
}

function descendentes(elemento: Element, nome = "*"): Element[] {
  return Array.from(elemento.getElementsByTagNameNS(NS_BPMN, nome));
}

function filhos(elemento: Element, nome: string): Element[] {
  return Array.from(elemento.children).filter((filho) => filho.namespaceURI === NS_BPMN && filho.localName === nome);
}

function textoDosFilhos(elemento: Element, nome: string): string[] {
  return filhos(elemento, nome).map((filho) => limpar(filho.textContent)).filter(Boolean);
}

interface Saida {
  alvo: string;
  rotulo: string;
}

// null quando o arquivo não é um BPMN 2.0 válido.
export function bpmnParaTexto(xml: string): BpmnConvertido | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const raiz = doc.documentElement;
  if (doc.getElementsByTagName("parsererror").length > 0 || raiz.namespaceURI !== NS_BPMN || raiz.localName !== "definitions") {
    return null;
  }

  const porId = new Map<string, Element>();
  for (const elemento of descendentes(raiz)) {
    const id = elemento.getAttribute("id");
    if (id) porId.set(id, elemento);
  }

  const participantes = descendentes(raiz, "participant");
  const participantePorProcesso = new Map(participantes.map((item) => [item.getAttribute("processRef") ?? "", nomeDe(item)]));
  const variosParticipantes = participantes.length > 1;

  // Documentos e dados: a referência pode não ter nome e herdar o do objeto de dados.
  const nomeDoDado = (id: string): string => {
    const referencia = porId.get(id);
    if (!referencia) return "";
    return nomeDe(referencia) || nomeDe(porId.get(referencia.getAttribute("dataObjectRef") ?? ""));
  };
  const dados = Array.from(new Set(
    [...descendentes(raiz, "dataObjectReference"), ...descendentes(raiz, "dataStoreReference")]
      .map((referencia) => nomeDoDado(referencia.getAttribute("id") ?? ""))
      .filter(Boolean),
  ));

  const anotacoes = new Map(descendentes(raiz, "textAnnotation").map((item) => [item.getAttribute("id") ?? "", textoDosFilhos(item, "text").join(" ")]));
  const notasPorElemento = new Map<string, string[]>();
  const anotacoesVinculadas = new Set<string>();
  for (const associacao of descendentes(raiz, "association")) {
    const origem = associacao.getAttribute("sourceRef") ?? "";
    const destino = associacao.getAttribute("targetRef") ?? "";
    const [anotacao, elemento] = anotacoes.has(destino) ? [destino, origem] : [origem, destino];
    const texto = anotacoes.get(anotacao);
    if (!texto || !elemento) continue;
    notasPorElemento.set(elemento, [...(notasPorElemento.get(elemento) ?? []), texto]);
    anotacoesVinculadas.add(anotacao);
  }

  const secoes: string[] = [LEGENDA];
  let totalElementos = 0;

  for (const processo of filhos(raiz, "process")) {
    const nos = descendentes(processo).filter((elemento) => ROTULO_ELEMENTO[elemento.localName] && elemento.getAttribute("id"));
    if (nos.length === 0) continue;
    totalElementos += nos.length;
    const participante = participantePorProcesso.get(processo.getAttribute("id") ?? "") ?? "";

    // Raias internas vêm depois das externas no documento e prevalecem.
    const raiaPorNo = new Map<string, string>();
    const raias: string[] = [];
    for (const raia of descendentes(processo, "lane")) {
      const nome = nomeDe(raia);
      if (!nome) continue;
      if (!raias.includes(nome)) raias.push(nome);
      for (const id of textoDosFilhos(raia, "flowNodeRef")) raiaPorNo.set(id, nome);
    }

    const saidas = new Map<string, Saida[]>();
    const padroes = new Set(nos.map((no) => no.getAttribute("default")).filter(Boolean));
    for (const fluxo of descendentes(processo, "sequenceFlow")) {
      const origem = fluxo.getAttribute("sourceRef") ?? "";
      const id = fluxo.getAttribute("id") ?? "";
      const condicao = textoDosFilhos(fluxo, "conditionExpression").join(" ");
      const rotulo = nomeDe(fluxo) || condicao || (padroes.has(id) ? "caso contrário" : "");
      saidas.set(origem, [...(saidas.get(origem) ?? []), { alvo: fluxo.getAttribute("targetRef") ?? "", rotulo }]);
    }

    const bordasPorTarefa = new Map<string, Element[]>();
    for (const borda of nos.filter((no) => no.localName === "boundaryEvent")) {
      const tarefa = borda.getAttribute("attachedToRef") ?? "";
      bordasPorTarefa.set(tarefa, [...(bordasPorTarefa.get(tarefa) ?? []), borda]);
    }

    // Percorre o fluxo a partir dos inícios; o que não estiver ligado entra na ordem do arquivo.
    const idsDoProcesso = new Set(nos.map((no) => no.getAttribute("id")!));
    const ordem: Element[] = [];
    const visitados = new Set<string>();
    const percorrer = (inicio: string) => {
      const pilha = [inicio];
      while (pilha.length > 0) {
        const id = pilha.pop()!;
        if (visitados.has(id) || !idsDoProcesso.has(id)) continue;
        visitados.add(id);
        ordem.push(porId.get(id)!);
        const proximos = [
          ...(bordasPorTarefa.get(id) ?? []).map((borda) => borda.getAttribute("id")!),
          ...(saidas.get(id) ?? []).map((saida) => saida.alvo),
        ];
        pilha.push(...proximos.reverse());
      }
    };
    const inicios = nos.filter((no) => no.localName === "startEvent" && no.parentElement === processo);
    for (const no of [...inicios, ...nos]) percorrer(no.getAttribute("id")!);
    const numero = new Map(ordem.map((no, indice) => [no.getAttribute("id")!, indice + 1]));

    const linhas = ordem.map((no, indice) => {
      const id = no.getAttribute("id")!;
      const evento = Array.from(no.children).map((filho) => ROTULO_EVENTO[filho.localName]).find(Boolean);
      const tipo = `${ROTULO_ELEMENTO[no.localName]}${evento ? ` por ${evento}` : ""}`;
      const responsavel = raiaPorNo.get(id) || (variosParticipantes ? participante : "");
      const detalhes: string[] = [];

      if (no.localName === "boundaryEvent") {
        const tarefa = no.getAttribute("attachedToRef") ?? "";
        detalhes.push(`durante ${numero.get(tarefa) ?? "?"} (${nomeDe(porId.get(tarefa)) || "sem nome"})`);
      }
      const usa = filhos(no, "dataInputAssociation").flatMap((associacao) => textoDosFilhos(associacao, "sourceRef")).map(nomeDoDado).filter(Boolean);
      const gera = filhos(no, "dataOutputAssociation").flatMap((associacao) => textoDosFilhos(associacao, "targetRef")).map(nomeDoDado).filter(Boolean);
      if (usa.length > 0) detalhes.push(`usa: ${usa.join(", ")}`);
      if (gera.length > 0) detalhes.push(`gera: ${gera.join(", ")}`);
      for (const nota of notasPorElemento.get(id) ?? []) detalhes.push(`nota: "${nota}"`);

      const caminhos = saidas.get(id) ?? [];
      const seguinte = caminhos.length === 1 && !caminhos[0].rotulo && numero.get(caminhos[0].alvo) === indice + 2;
      const destino = seguinte || (caminhos.length === 0 && no.localName === "endEvent")
        ? ""
        : caminhos.length === 0
          ? " → (o fluxo não continua no diagrama)"
          : ` → ${caminhos.map((caminho) => `${caminho.rotulo ? `"${caminho.rotulo}": ` : ""}${numero.get(caminho.alvo) ?? "?"}`).join("; ")}`;

      return `${indice + 1}. [${tipo}] ${nomeDe(no) || "(sem nome)"}${responsavel ? ` — ${responsavel}` : ""}${detalhes.map((item) => ` | ${item}`).join("")}${destino}`;
    });

    secoes.push([
      `Processo: ${nomeDe(processo) || participante || "(sem nome)"}${participante && nomeDe(processo) ? ` (participante: ${participante})` : ""}`,
      ...(raias.length > 0 ? [`Responsáveis (raias): ${raias.join(", ")}`] : []),
      "Fluxo:",
      ...linhas,
    ].join("\n"));
  }

  if (dados.length > 0) secoes.push(`Documentos e dados: ${dados.join(", ")}`);

  const soltas = Array.from(anotacoes).filter(([id, texto]) => texto && !anotacoesVinculadas.has(id)).map(([, texto]) => `- ${texto}`);
  if (soltas.length > 0) secoes.push(["Anotações:", ...soltas].join("\n"));

  const mensagens = descendentes(raiz, "messageFlow").map((fluxo) => {
    const nome = (id: string) => nomeDe(porId.get(id)) || "(sem nome)";
    const rotulo = nomeDe(fluxo);
    return `- ${nome(fluxo.getAttribute("sourceRef") ?? "")} → ${nome(fluxo.getAttribute("targetRef") ?? "")}${rotulo ? `: "${rotulo}"` : ""}`;
  });
  if (mensagens.length > 0) secoes.push(["Comunicação entre participantes:", ...mensagens].join("\n"));

  return { texto: secoes.join("\n\n"), totalElementos };
}

// Só um diagrama com o desenho (BPMNDI) pode ser aberto como mapa no editor.
export function temDesenhoBpmn(xml: string): boolean {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return doc.getElementsByTagNameNS(NS_BPMNDI, "BPMNShape").length > 0;
}
