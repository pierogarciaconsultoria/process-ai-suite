# Aplicar no backend o que já está no repositório

Nenhum arquivo de código será alterado.

1. Aplicar as migrations, nesta ordem, com o conteúdo exato dos arquivos:
   - `202610260001_add_entrevista_roteiro.sql`
   - `202610270001_ciclo_de_vida_processos.sql`
   Se a primeira falhar, a segunda não será executada e o erro será informado.
2. Publicar a função `ai-interview-roteiro` (configuração `verify_jwt = true` já presente) e verificar o deploy nos logs.
3. Confirmar que o segredo `OPENAI_API_KEY` está configurado (já consta na lista de segredos do projeto, o mesmo usado pela `ai-interview`).

A função `ai-interview` não será removida.
