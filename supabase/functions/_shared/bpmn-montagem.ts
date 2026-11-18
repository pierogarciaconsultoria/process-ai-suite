// Monta o XML BPMN 2.0 (pool, raias, sistemas e layout) a partir de uma estrutura simples.
// A IA só decide a estrutura; posição e desenho ficam com o código, para nenhuma atividade sumir.

export type TipoNo = "inicio" | "fim" | "tarefa" | "decisao";

export interface NoEstrutura {
  id: string;
  tipo: TipoNo;
  nome: string;
  raia: string;
  sistema?: string;
}

export interface FluxoEstrutura {
  de: string;
  para: string;
  rotulo?: string;
}

export interface EstruturaBpmn {
  raias: string[];
  nos: NoEstrutura[];
  fluxos: FluxoEstrutura[];
}

interface EtapaEntrevista {
  atividade?: string;
  responsavel?: string;
  ferramentaDocumento?: string;
}

const TIPOS: TipoNo[] = ["inicio", "fim", "tarefa", "decisao"];

const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");

/** Valida e limpa a estrutura vinda da IA. Devolve null se não der para desenhar. */
export function normalizarEstrutura(bruta: unknown): EstruturaBpmn | null {
  if (!bruta || typeof bruta !== "object") return null;
  const entrada = bruta as Record<string, unknown>;
  if (!Array.isArray(entrada.nos) || !Array.isArray(entrada.fluxos)) return null;

  const idNovo = new Map<string, string>();
  const nos: NoEstrutura[] = [];
  for (const item of entrada.nos) {
    if (!item || typeof item !== "object") continue;
    const no = item as Record<string, unknown>;
    const idOriginal = texto(no.id);
    const tipo = texto(no.tipo) as TipoNo;
    if (!idOriginal || idNovo.has(idOriginal) || !TIPOS.includes(tipo)) continue;
    const id = `No_${nos.length + 1}`;
    idNovo.set(idOriginal, id);
    nos.push({
      id,
      tipo,
      nome: texto(no.nome),
      raia: texto(no.raia) || "Processo",
      ...(texto(no.sistema) ? { sistema: texto(no.sistema) } : {}),
    });
  }
  if (!nos.some((no) => no.tipo === "inicio") || !nos.some((no) => no.tipo === "fim")) return null;

  const fluxos: FluxoEstrutura[] = [];
  for (const item of entrada.fluxos) {
    if (!item || typeof item !== "object") continue;
    const fluxo = item as Record<string, unknown>;
    const de = idNovo.get(texto(fluxo.de));
    const para = idNovo.get(texto(fluxo.para));
    if (!de || !para || de === para) continue;
    fluxos.push({ de, para, ...(texto(fluxo.rotulo) ? { rotulo: texto(fluxo.rotulo) } : {}) });
  }
  if (fluxos.length === 0) return null;

  // Raias na ordem pedida pela IA; as que só aparecem nos nós entram no fim.
  const pedidas = Array.isArray(entrada.raias) ? entrada.raias.map(texto).filter(Boolean) : [];
  const raias = [...new Set([...pedidas, ...nos.map((no) => no.raia)])].filter((raia) => nos.some((no) => no.raia === raia));
  return { raias, nos, fluxos };
}

/** Fluxo em linha, uma raia por responsável. Usado quando a IA falha ou deixa atividades de fora. */
export function estruturaLinear(etapas: EtapaEntrevista[], gatilho: string, fim: string): EstruturaBpmn {
  const tarefas = etapas.filter((etapa) => texto(etapa.atividade));
  const raiaDe = (etapa: EtapaEntrevista) => texto(etapa.responsavel).split(/[,;]| ou /)[0].trim() || "Processo";
  const primeiraRaia = tarefas.length ? raiaDe(tarefas[0]) : "Processo";
  const ultimaRaia = tarefas.length ? raiaDe(tarefas[tarefas.length - 1]) : "Processo";
  const nos: NoEstrutura[] = [
    { id: "No_inicio", tipo: "inicio", nome: gatilho || "Início", raia: primeiraRaia },
    ...tarefas.map((etapa, i): NoEstrutura => ({
      id: `No_${i + 1}`,
      tipo: "tarefa",
      nome: texto(etapa.atividade),
      raia: raiaDe(etapa),
      ...(texto(etapa.ferramentaDocumento) ? { sistema: texto(etapa.ferramentaDocumento) } : {}),
    })),
    { id: "No_fim", tipo: "fim", nome: fim || "Fim", raia: ultimaRaia },
  ];
  const fluxos = nos.slice(1).map((no, i) => ({ de: nos[i].id, para: no.id }));
  return { raias: [...new Set(nos.map((no) => no.raia))], nos, fluxos };
}

const esc = (valor: string) =>
  valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const POOL_X = 100;
const POOL_Y = 80;
const ROTULO_POOL = 30;
const ALTURA_RAIA = 220;
const LARGURA_COLUNA = 170;
const MARGEM_ESQUERDA = 70;

const TAMANHO: Record<TipoNo, { w: number; h: number }> = {
  inicio: { w: 36, h: 36 },
  fim: { w: 36, h: 36 },
  tarefa: { w: 110, h: 80 },
  decisao: { w: 50, h: 50 },
};

interface Caixa { x: number; y: number; w: number; h: number }

export function montarBpmnXml(estrutura: EstruturaBpmn, nomeProcesso: string): string {
  const { raias, nos, fluxos } = estrutura;
  const saidas = new Map<string, string[]>();
  for (const fluxo of fluxos) saidas.set(fluxo.de, [...(saidas.get(fluxo.de) ?? []), fluxo.para]);

  // Coluna = ordem em largura a partir dos inícios; nós soltos vão para o fim.
  const ordem: string[] = [];
  const fila = nos.filter((no) => no.tipo === "inicio").map((no) => no.id);
  const visto = new Set(fila);
  while (fila.length) {
    const id = fila.shift()!;
    ordem.push(id);
    for (const prox of saidas.get(id) ?? []) if (!visto.has(prox)) { visto.add(prox); fila.push(prox); }
  }
  for (const no of nos) if (!visto.has(no.id)) ordem.push(no.id);
  const coluna = new Map(ordem.map((id, i) => [id, i]));

  const topoRaia = (raia: string) => POOL_Y + raias.indexOf(raia) * ALTURA_RAIA;
  const caixa = new Map<string, Caixa>();
  for (const no of nos) {
    const { w, h } = TAMANHO[no.tipo];
    const centroX = POOL_X + ROTULO_POOL + MARGEM_ESQUERDA + coluna.get(no.id)! * LARGURA_COLUNA;
    const centroY = topoRaia(no.raia) + 80;
    caixa.set(no.id, { x: centroX - w / 2, y: centroY - h / 2, w, h });
  }

  const largura = ROTULO_POOL + MARGEM_ESQUERDA * 2 + Math.max(0, ordem.length - 1) * LARGURA_COLUNA;
  const altura = raias.length * ALTURA_RAIA;

  const tag = (no: NoEstrutura) =>
    no.tipo === "inicio" ? "startEvent"
      : no.tipo === "fim" ? "endEvent"
      : no.tipo === "decisao" ? "exclusiveGateway"
      : no.sistema ? "userTask" : "task";

  const elementos: string[] = [];
  const formas: string[] = [];
  const arestas: string[] = [];

  nos.forEach((no) => {
    const c = caixa.get(no.id)!;
    let associacao = "";
    if (no.tipo === "tarefa" && no.sistema) {
      const store = `${no.id}_sistema`;
      elementos.push(`<bpmn:dataStoreReference id="${store}" name="${esc(no.sistema)}" />`);
      associacao = `<bpmn:dataOutputAssociation id="${no.id}_assoc"><bpmn:targetRef>${store}</bpmn:targetRef></bpmn:dataOutputAssociation>`;
      const sx = c.x + c.w / 2 - 25;
      const sy = c.y + c.h + 30;
      formas.push(`<bpmndi:BPMNShape id="${store}_di" bpmnElement="${store}"><dc:Bounds x="${sx}" y="${sy}" width="50" height="40" /></bpmndi:BPMNShape>`);
      arestas.push(`<bpmndi:BPMNEdge id="${no.id}_assoc_di" bpmnElement="${no.id}_assoc"><di:waypoint x="${c.x + c.w / 2}" y="${c.y + c.h}" /><di:waypoint x="${c.x + c.w / 2}" y="${sy}" /></bpmndi:BPMNEdge>`);
    }
    elementos.push(`<bpmn:${tag(no)} id="${no.id}" name="${esc(no.nome)}">${associacao}</bpmn:${tag(no)}>`);
    formas.push(`<bpmndi:BPMNShape id="${no.id}_di" bpmnElement="${no.id}"${no.tipo === "decisao" ? ' isMarkerVisible="true"' : ""}><dc:Bounds x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" /></bpmndi:BPMNShape>`);
  });

  fluxos.forEach((fluxo, i) => {
    const id = `Fluxo_${i + 1}`;
    elementos.push(`<bpmn:sequenceFlow id="${id}" sourceRef="${fluxo.de}" targetRef="${fluxo.para}"${fluxo.rotulo ? ` name="${esc(fluxo.rotulo)}"` : ""} />`);
    const a = caixa.get(fluxo.de)!;
    const b = caixa.get(fluxo.para)!;
    const ay = a.y + a.h / 2;
    const by = b.y + b.h / 2;
    let pontos: [number, number][];
    if (b.x > a.x + a.w) {
      const sx = a.x + a.w;
      const tx = b.x;
      const mx = tx - 25;
      pontos = ay === by ? [[sx, ay], [tx, by]] : [[sx, ay], [mx, ay], [mx, by], [tx, by]];
    } else {
      // Volta para trás: sai por cima e entra por cima, pela faixa livre no topo das raias.
      const topo = Math.min(a.y, b.y) - 25;
      pontos = [[a.x + a.w / 2, a.y], [a.x + a.w / 2, topo], [b.x + b.w / 2, topo], [b.x + b.w / 2, b.y]];
    }
    arestas.push(`<bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">${pontos.map(([x, y]) => `<di:waypoint x="${x}" y="${y}" />`).join("")}</bpmndi:BPMNEdge>`);
  });

  const lanes = raias.map((raia, i) => {
    const refs = nos.filter((no) => no.raia === raia).map((no) => `<bpmn:flowNodeRef>${no.id}</bpmn:flowNodeRef>`).join("");
    formas.unshift(`<bpmndi:BPMNShape id="Raia_${i + 1}_di" bpmnElement="Raia_${i + 1}" isHorizontal="true"><dc:Bounds x="${POOL_X + ROTULO_POOL}" y="${topoRaia(raia)}" width="${largura - ROTULO_POOL}" height="${ALTURA_RAIA}" /></bpmndi:BPMNShape>`);
    return `<bpmn:lane id="Raia_${i + 1}" name="${esc(raia)}">${refs}</bpmn:lane>`;
  });
  formas.unshift(`<bpmndi:BPMNShape id="Pool_di" bpmnElement="Pool" isHorizontal="true"><dc:Bounds x="${POOL_X}" y="${POOL_Y}" width="${largura}" height="${altura}" /></bpmndi:BPMNShape>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definicoes" targetNamespace="http://processhub.app.br/bpmn">
<bpmn:collaboration id="Colaboracao"><bpmn:participant id="Pool" name="${esc(nomeProcesso || "Processo")}" processRef="Processo_1" /></bpmn:collaboration>
<bpmn:process id="Processo_1" isExecutable="false">
<bpmn:laneSet id="Raias">${lanes.join("")}</bpmn:laneSet>
${elementos.join("\n")}
</bpmn:process>
<bpmndi:BPMNDiagram id="Diagrama"><bpmndi:BPMNPlane id="Plano" bpmnElement="Colaboracao">
${formas.join("\n")}
${arestas.join("\n")}
</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

/** Quantas tarefas a estrutura tem; serve para checar se a IA deixou atividades de fora. */
export const totalDeTarefas = (estrutura: EstruturaBpmn) => estrutura.nos.filter((no) => no.tipo === "tarefa").length;
