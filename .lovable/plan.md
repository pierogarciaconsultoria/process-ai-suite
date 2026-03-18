

## Plano: Corrigir erro de build causado pelos imports CSS do bpmn-js

### Problema
Os `@import` de CSS do `bpmn-js` no `src/index.css` (linhas 2-4) estão causando falha de build. O Vite não consegue resolver corretamente esses caminhos via `@import` no CSS, resultando em erro 500 nos chunks e a página não carrega.

### Solução
Mover os imports de CSS do bpmn-js do `src/index.css` para o `src/main.tsx`, onde o Vite consegue resolver imports de `node_modules` via JavaScript:

**1. `src/index.css`** — Remover as 3 linhas de `@import` do bpmn-js (linhas 2-4)

**2. `src/main.tsx`** — Adicionar os imports CSS antes do `index.css`:
```typescript
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
```

Isso resolve o problema de resolução de módulos mantendo os estilos disponíveis globalmente.

