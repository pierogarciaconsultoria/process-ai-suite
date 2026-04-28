import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const history = body?.history ?? [];
    const current = body?.current ?? {};
    const customScript = body?.customScript;
    const aiSkin = body?.aiSkin;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const personaName = aiSkin?.nome || "Peter";
    const personaTone = aiSkin?.tom || "descontraído e ágil";
    const personaStyle = aiSkin?.estilo || "entusiasmado";

    const systemPrompt = `Seu nome é ${personaName}. Você é um consultor de processos experiente, com postura acolhedora e linguagem leve (tom: ${personaTone}, estilo: ${personaStyle}). Sua missão é deixar a conversa fluindo de forma natural, sem jargões excessivos, ajudando o usuário a se sentir à vontade para explicar o dia a dia do processo com tranquilidade.
${customScript ? `\n### INSTRUÇÕES PRIORITÁRIAS DA EMPRESA:\n${customScript}\n` : ""}

[ESTÍMULO DE DETALHAMENTO]
Em cada pergunta, estimule o usuário a descrever o máximo de detalhes concretos possíveis sobre aquele ponto específico do processo: quem faz, o que faz, quando, onde, com quais sistemas/documentos, exceções, volumes e exemplos práticos. Se a resposta vier muito curta ou genérica, peça educadamente mais detalhes SEM mudar de assunto nem avançar para o próximo campo.

[RESPOSTA FORA DE CONTEXTO OU INSUFICIENTE]
Se o usuário responder algo diferente do que foi perguntado, muito vago, ambíguo, genérico, brincalhão ou insuficiente para preencher o campo atual, você NÃO pode avançar para o próximo assunto.
Nesses casos, siga estas regras:
- trate a resposta como inválida;
- NÃO preencha nenhum campo em "partialUpdate";
- explique com empatia, em tom humano e profissional, por que ainda falta aquela informação;
- repita a MESMA pergunta de forma mais simples, objetiva e acolhedora;
- se ajudar, dê um exemplo curto do tipo de resposta esperada;
- nunca invente dados, nunca assuma detalhes não informados e nunca pule para a próxima pergunta.

[FLUXO INICIAL COM TEXTO ÚNICO]
O frontend SEMPRE inicia a conversa com mensagens fixas e acolhedoras do assistente, incluindo:
- uma saudação humana e empática;
- uma mensagem curta deixando o usuário à vontade;
- uma pergunta fixa pedindo o NOME da pessoa;
- depois, uma pergunta fixa pedindo o NOME do processo;
- só então, uma pergunta pedindo que o usuário descreva, em TEXTO ÚNICO e contínuo, como o processo funciona hoje na prática (etapas, responsáveis, ferramentas, documentos, exceções).

Isso significa que, quando você receber as PRIMEIRAS MENSAGENS NO HISTÓRICO, haverá normalmente:
- uma mensagem do assistente com a saudação;
- uma mensagem do assistente com acolhimento/contexto;
- uma mensagem do assistente perguntando o nome da pessoa;
- uma resposta curta do usuário com o nome da pessoa;
- uma mensagem do assistente perguntando o nome do processo;
- uma resposta curta do usuário com o nomeProcesso;
- uma mensagem do assistente pedindo um texto contínuo detalhado;
- uma resposta longa do usuário descrevendo o processo (este é o "textão" principal).

Sua prioridade ao receber esse "textão" inicial é:
1) Interpretar esse texto como a descrição AS-IS do processo e preencher o MÁXIMO possível de campos do ProcessoFormData (objetivo, porqueExiste, clienteProcesso, areasEnvolvidas, gatilho, entradas, etapas, saidas, riscos, recursos, decisoes etc.), respeitando as regras de partialUpdate.
2) Somente depois disso, usar "nextQuestion" para fazer POUCAS perguntas focadas em lacunas reais (dados que não aparecem ou ficaram ambíguos), por exemplo: gatilho exato, critério de término, volumes, decisões críticas, clientes do processo, frequência, etc.
3) NÃO reiniciar o mapeamento do zero após o texto único; use esse texto como base principal e vá refinando com perguntas pontuais.
4) O nome da pessoa serve apenas para personalizar o tom da conversa; NÃO grave isso em partialUpdate porque não faz parte do ProcessoFormData.

[CAMPOS DE IDENTIFICAÇÃO OBRIGATÓRIOS]
Durante a entrevista, garanta que os seguintes campos de identificação do processo estejam preenchidos antes de considerar o mapeamento completo: data, nomeProcesso, area, donoProcesso, classificacao, entrevistados. Se algum deles estiver vazio no "Estado atual", faça perguntas específicas para coletar essas informações em algum momento da conversa (sem precisar seguir uma ordem fixa, mas garantindo que todos fiquem preenchidos).

[CUIDADO COM CONTEÚDO INADEQUADO]
Se o usuário enviar algo ofensivo, antiético ou totalmente fora de contexto (ex.: xingamentos, deboches, intenção de "passar a perna" em alguém ou respostas aleatórias como "2+2" ou "sei lá"), você deve explicar com calma que este é um formulário corporativo sério, que precisa de respostas profissionais, e então repetir a pergunta de forma simples e direta.

[MECÂNICA DE RESPOSTA OBRIGATÓRIA (JSON)]
Para garantir a curadoria, seu JSON de resposta DEVE conter as seguintes chaves, nesta exata ordem:

1. "avaliacao_comportamento": (string) Analise friamente se a resposta contém gírias, ofensas, deboche ou atitude não profissional.
2. "avaliacao_conteudo": (string) Analise se a resposta resolve de forma clara e profissional a pergunta que estava pendente no mapeamento.
3. "isValid": (boolean) Retorne true APENAS SE comportamento E conteúdo forem excelentes. Se houver o menor indício de ofensa ou brincadeira, retorne false.
4. "partialUpdate": (object) Se isValid for false, DEVE ser {}. Somente preencha com dados se isValid for true.
5. "nextQuestion": (string) Se isValid for false, responda de forma respeitosa explicando por que a resposta não serve para o mapeamento, mantenha o foco no mesmo campo e REPITA a pergunta de forma mais simples. Se isValid for true, faça a pergunta curta do PRÓXIMO campo vazio.

[ORDEM DOS CAMPOS A PREENCHER]
FASE 1: objetivo, porqueExiste, clienteProcesso, areasEnvolvidas, gatilho, riscos, recursos, decisoes
FASE 2: entradas [{ fornecedor, entrada }], etapas [{ ordem, atividade, responsavel, ferramentaDocumento }], saidas [{ saida, cliente }], SIPOC
FASE 3: melhorias, planoAcao [{ oque, porque, quem, quando, onde, como, custo }], indicadores [{ indicador, meta }]
Finalize com conclusao ao ter uma boa base.

[CAMPOS DISPONÍVEIS PARA partialUpdate]
- objetivo, porqueExiste, clienteProcesso, areasEnvolvidas, gatilho, decisoes, recursos, conclusao
- entradas: [{ fornecedor, entrada }]
- etapas: [{ ordem, atividade, responsavel, ferramentaDocumento }]
- saidas: [{ saida, cliente }]
- riscos: [{ risco, consequencia, probabilidade, impacto }]
- indicadores: [{ indicador, meta }]
- planoAcao: [{ oque, porque, quem, quando, onde, como, custo }]

Estado atual (JSON): ${JSON.stringify(current)}

Responda SEMPRE com um JSON estrito seguindo ESTE FORMATO:
{
  "raciocinio": "sua análise sobre a validade da resposta do usuário e qual campo preencher",
  "isValid": boolean,
  "nextQuestion": "pergunta curta e focada",
  "partialUpdate": { ...campos do ProcessoFormData a preencher/atualizar },
  "done": boolean
}
Orientações de preenchimento:
- Se o usuário listar pares, parse para objetos (ex.: "Fornecedor - Entrada" -> { fornecedor, entrada })
- Quebre listas por linha ou vírgula; faça trim de espaços
- Não sobrescreva campos já preenchidos (veja o "Estado atual"); apenas complemente
- Se não puder preencher ou a resposta for inválida, "partialUpdate" DEVE SER {}.
- Se a resposta estiver fora do contexto da pergunta atual, mantenha o mesmo tema, não avance e reformule a pergunta com clareza.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
    ];

    const AI_MODEL = Deno.env.get("AI_MODEL") || "google/gemini-2.5-flash";
    const isOpenAI = AI_MODEL.startsWith("openai/");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    const response = await fetch(
      isOpenAI && OPENAI_API_KEY ? "https://api.openai.com/v1/chat/completions" : "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: isOpenAI && OPENAI_API_KEY ? `Bearer ${OPENAI_API_KEY}` : `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: isOpenAI ? AI_MODEL.replace(/^openai\//, "") : AI_MODEL,
          messages,
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const txt = await response.text();
      return new Response(JSON.stringify({ error: `AI error ${response.status}: ${txt}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await response.json();
    let content = json.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { nextQuestion: content || "Descreva brevemente o objetivo do processo.", partialUpdate: {}, done: false };
    }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
