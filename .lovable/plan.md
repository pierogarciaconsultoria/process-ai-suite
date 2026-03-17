

## Problem

The `ProcessoFormulario.tsx` has regressed:
1. `"saidas"` is missing from the `TABS` array — no separate tab exists
2. Saídas UI is a simple `<Textarea>` inside the Decisões tab instead of a dynamic SIPOC table
3. The `form.saidas` is being used as a string, but the type definition (`SaidaForm[]`) expects an array

## Fix

### 1. Add `"saidas"` to TABS array (after `"decisoes"`)
```
TABS = [..., "decisoes", "saidas", "recursos", ...]
```

### 2. Add label to TAB_LABELS
```
saidas: "6. Saídas"
```
Renumber subsequent tabs (Recursos → 7, Dores → 8, Riscos → 9, Controles → 10, Melhorias → 11, Plano → 12).

### 3. Split the TabsContent
- **Decisões tab**: Keep only the Decisões textarea
- **New Saídas tab**: Dynamic table with columns Saída (Output) and Cliente (Customer), with add/remove row buttons — matching the `SaidaForm[]` type

### 4. Fix data binding
Ensure `form.saidas` is treated as `SaidaForm[]` (array), not a string, with proper indexed updates matching the Entradas pattern.

