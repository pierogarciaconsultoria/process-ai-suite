

## Plano: BPMN Canvas com Geração Automática por IA

### O que será implementado

Dois componentes trabalhando juntos: o editor visual (bpmn-js) e uma edge function que gera o XML BPMN a partir dos dados do formulário.

### Estrutura

**1. Instalar `bpmn-js`** — biblioteca de renderização/edição BPMN 2.0

**2. Implementar `BPMNCanvas.tsx`**
- Inicializa `BpmnModeler` (editável) ou `BpmnViewer` (read-only) dentro de um div ref
- Props: `xml`, `onChange`, `readOnly`
- Diagrama vazio padrão quando não há XML
- Toolbar: zoom, fit, exportar XML
- Botão "Gerar Mapa com IA" que chama a edge function

**3. Nova edge function `ai-generate-bpmn`**
- Recebe: etapas, decisões, gatilho, entradas, saídas do formulário
- System prompt instrui o modelo a gerar XML BPMN 2.0 válido com:
  - StartEvent, EndEvent
  - UserTask/ServiceTask para cada atividade
  - ExclusiveGateway para decisões
  - SequenceFlow conectando tudo
  - Posicionamento (waypoints) para layout legível
- Retorna o XML como string
- Modelo: `google/gemini-2.5-flash`

**4. Campos no form data** (`processo-form-types.ts`)
- Adicionar `bpmnAsIs: string` e `bpmnToBe: string` ao `ProcessoFormData`

**5. Integração no formulário** (`ProcessoFormulario.tsx`)
- Aba "Mapa AS IS": BPMNCanvas com botão "Gerar Mapa com IA" que envia atividades atuais
- Aba "Mapa TO BE": BPMNCanvas separado, gera com base nas melhorias da Fase 3
- XML salvo no state do formulário via `onChange`

### Fluxo do usuário

```text
Preenche Atividades → Vai em "Mapa AS IS" → Clica "Gerar Mapa com IA"
→ IA gera XML BPMN → bpmn-js renderiza → Usuário edita se quiser
```

### Arquivos

| Arquivo | Ação |
|---------|------|
| `package.json` | Adicionar `bpmn-js` |
| `src/components/BPMNCanvas.tsx` | Implementação completa |
| `supabase/functions/ai-generate-bpmn/index.ts` | Nova edge function |
| `supabase/config.toml` | Registrar nova function |
| `src/data/processo-form-types.ts` | Campos `bpmnAsIs`, `bpmnToBe` |
| `src/pages/ProcessoFormulario.tsx` | Conectar canvas + botão IA |

