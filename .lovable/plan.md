# Correção do erro `Failed to execute 'removeChild' on 'Node'`

## Causa raiz

Dois problemas independentes produzem o mesmo sintoma:

1. **Tradução automática do navegador** altera o DOM gerenciado pelo React, quebrando a reconciliação. Esse é o motivo do crash global mostrado no screenshot (com tela em branco).
2. **`EntrevistaProcesso.tsx`** tem uma dependência instável (`enqueueAssistantMessage`) no `useEffect` de inicialização. Isso reexecuta o effect a cada render, e a fila de mensagens (`assistantQueueRef`) chama `setMessages` mesmo após desmonte, causando `removeChild` quando o usuário navega para fora durante a animação.

## Mudanças

### 1. `index.html`
- Adicionar `translate="no"` e classe `notranslate` no `<html>` para impedir que Chrome/Edge tente traduzir e alterar text-nodes do React.
- Adicionar `<meta name="google" content="notranslate">`.

### 2. `src/pages/EntrevistaProcesso.tsx`
- Envolver `enqueueAssistantMessage` em `useCallback` (deps: `[]`, usando `isMountedRef`) para que a função fique estável entre renders.
- Como alternativa equivalente e menos invasiva: remover `enqueueAssistantMessage` do array de dependências do `useEffect` de inicialização (linha 187), já que a função apenas usa refs.
- Substituir o JSX condicional do botão Enviar
  ```jsx
  {assistantBusy ? "Aguarde..." : <>Enviar <Send/></>}
  ```
  por uma única árvore estável (sempre renderizar `<span>` + ícone, alternando apenas o texto), eliminando o swap de tipos de filhos que também pode gerar `removeChild` em casos extremos.
- Garantir que `enqueueAssistantMessage` cheque `isMountedRef.current` antes de cada `setState` (já faz isso, mas validar).

### 3. `src/components/AppSidebar.tsx`
- Manter o `queueMicrotask` e `translate="no"` já adicionados (são parte da mesma classe de defesa).

## Arquivos modificados
- `index.html`
- `src/pages/EntrevistaProcesso.tsx`

## Critério de aceite
- Recarregar `/dashboard` com Google Translate ativo no Chrome — sem erro `removeChild`, sem tela branca.
- Navegar para `/processos/novo/entrevista`, esperar a saudação aparecer e voltar para `/dashboard` antes do fim — sem erro no console.
