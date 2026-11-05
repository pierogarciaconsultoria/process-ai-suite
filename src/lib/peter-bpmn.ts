// O conversor de BPMN em texto fica nas funções compartilhadas: a geração de documentos
// também usa o mapa do processo, no servidor.
export { bpmnParaTexto, temDesenhoBpmn, type BpmnConvertido } from "../../supabase/functions/_shared/bpmn-texto";
