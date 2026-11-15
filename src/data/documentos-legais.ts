// Política de privacidade e termos de uso do Peter (rotas /privacidade e /termos).
// MINUTA: o texto precisa de revisão jurídica antes de valer. Os campos "[a definir]" são do
// advogado ou da empresa. Ao mudar o texto de forma relevante, troque a VERSAO: todos os
// usuários verão o aceite de novo no próximo acesso (tabela aceites_termos).

export const VERSAO_DOCUMENTOS_LEGAIS = "2026-11-15";

// true mostra o aviso "minuta em revisão jurídica" no topo das duas páginas.
export const DOCUMENTOS_EM_REVISAO = true;

export const EMPRESA_RESPONSAVEL = {
  nomeComercial: "Piero Garcia Consultoria",
  razaoSocial: "[a definir]",
  cnpj: "[a definir]",
  endereco: "[a definir]",
  email: "contato@pierogarcia.com.br",
  encarregado: "[a definir]",
  foro: "[a definir]",
};

export type SecaoLegal = { titulo: string; paragrafos: string[] };
export type DocumentoLegal = { titulo: string; resumo: string; secoes: SecaoLegal[] };

const e = EMPRESA_RESPONSAVEL;

export const POLITICA_DE_PRIVACIDADE: DocumentoLegal = {
  titulo: "Política de privacidade",
  resumo: "Como o Peter trata os dados pessoais de quem usa a plataforma e dos dados que as empresas clientes registram nela.",
  secoes: [
    {
      titulo: "1. Quem somos",
      paragrafos: [
        `O Peter é uma plataforma de mapeamento de processos com inteligência artificial oferecida por ${e.nomeComercial} (razão social ${e.razaoSocial}, CNPJ ${e.cnpj}, ${e.endereco}).`,
        "Para os dados de cadastro e de uso da plataforma, atuamos como controladores. Para o conteúdo que as empresas clientes registram (processos, entrevistas, documentos e anexos), a empresa cliente é a controladora e o Peter atua como operador, tratando esses dados conforme as instruções e o contrato com a empresa cliente.",
      ],
    },
    {
      titulo: "2. Dados que tratamos",
      paragrafos: [
        "Cadastro e acesso: nome, e-mail, senha (guardada de forma cifrada pelo provedor de autenticação), empresa e perfil de acesso, convites recebidos e aceites destes documentos.",
        "Conteúdo das empresas clientes: descrições de processos, respostas das entrevistas, mensagens trocadas com o Peter, texto extraído de anexos (Word, PDF e imagem), documentos gerados, planos de ação, indicadores e chamados de suporte. Esse conteúdo pode citar nomes e cargos de colaboradores da empresa cliente.",
        "Dados técnicos: registros de acesso (data, hora e endereço IP) mantidos pelo provedor de hospedagem e a sessão de login guardada no navegador.",
        "O Peter não foi feito para tratar dados pessoais sensíveis (saúde, biometria, origem racial, convicções etc.). Pedimos que não sejam inseridos.",
      ],
    },
    {
      titulo: "3. Finalidades e bases legais",
      paragrafos: [
        "Criar e manter o acesso, controlar quem vê cada empresa e prestar o serviço contratado: execução de contrato (LGPD, art. 7º, V).",
        "Gerar mapas, procedimentos e respostas com inteligência artificial a partir do conteúdo informado: execução de contrato, conforme as instruções da empresa cliente.",
        "Segurança, prevenção de fraude, limites de uso e melhoria do serviço: legítimo interesse (art. 7º, IX), sempre com o mínimo de dados necessário.",
        "Guardar registros de acesso por 6 meses: cumprimento de obrigação legal (Marco Civil da Internet, art. 15).",
      ],
    },
    {
      titulo: "4. Com quem compartilhamos",
      paragrafos: [
        "Hospedagem, banco de dados, autenticação e armazenamento de arquivos: Supabase, por meio do Lovable Cloud.",
        "Inteligência artificial: OpenAI, nos Estados Unidos, que recebe as mensagens, as respostas das entrevistas e o texto dos anexos necessários para gerar cada resposta.",
        "Envio de e-mails de convite: provedor de e-mail transacional [a definir].",
        "Recursos de navegação: Google Fonts (fonte tipográfica) e jsDelivr (componentes de leitura de imagem), que recebem o endereço IP do navegador ao carregar esses arquivos.",
        "Não vendemos dados pessoais nem os usamos para publicidade. Podemos compartilhar dados com autoridades quando a lei exigir.",
      ],
    },
    {
      titulo: "5. Transferência internacional",
      paragrafos: [
        "Parte dos fornecedores acima processa dados fora do Brasil, em especial nos Estados Unidos. Essas transferências seguem o art. 33 da LGPD, com as salvaguardas contratuais oferecidas por cada fornecedor [a confirmar na revisão jurídica].",
      ],
    },
    {
      titulo: "6. Por quanto tempo guardamos",
      paragrafos: [
        "Os dados de cadastro e o conteúdo das empresas ficam guardados enquanto o contrato com a empresa cliente estiver ativo.",
        "Ao fim do contrato, a empresa cliente pode pedir a exportação dos seus dados; depois, eles são excluídos em até [a definir] dias, salvo obrigação legal de guarda.",
        "Registros de acesso: 6 meses. Cópias de segurança do provedor seguem o ciclo de retenção dele [a definir].",
      ],
    },
    {
      titulo: "7. Seus direitos",
      paragrafos: [
        "Você pode pedir confirmação de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade, informação sobre compartilhamento e revisão de decisões automatizadas (LGPD, art. 18).",
        `Para dados de cadastro, escreva para ${e.email}. Para o conteúdo de uma empresa cliente, o pedido é atendido em conjunto com a empresa, que é a controladora.`,
      ],
    },
    {
      titulo: "8. Segurança",
      paragrafos: [
        "Os dados de cada empresa ficam separados por regras de acesso no banco de dados, a comunicação é cifrada (HTTPS) e cada perfil só vê o que precisa. Em caso de incidente que possa gerar risco relevante, avisaremos as empresas afetadas e a ANPD nos prazos da regulamentação.",
      ],
    },
    {
      titulo: "9. Cookies e armazenamento no navegador",
      paragrafos: [
        "O Peter não usa cookies de publicidade nem ferramentas de rastreamento. O navegador guarda apenas o necessário para manter o login e preferências da tela, como a empresa ativa.",
      ],
    },
    {
      titulo: "10. Encarregado e contato",
      paragrafos: [`Encarregado pelo tratamento de dados pessoais: ${e.encarregado}. Contato: ${e.email}.`],
    },
    {
      titulo: "11. Alterações",
      paragrafos: ["Quando esta política mudar de forma relevante, avisaremos na plataforma e pediremos um novo aceite."],
    },
  ],
};

export const TERMOS_DE_USO: DocumentoLegal = {
  titulo: "Termos de uso",
  resumo: "Regras de uso do Peter por consultorias, empresas e pessoas convidadas por elas.",
  secoes: [
    {
      titulo: "1. O serviço",
      paragrafos: [
        `O Peter, oferecido por ${e.nomeComercial} (razão social ${e.razaoSocial}, CNPJ ${e.cnpj}), ajuda a mapear processos, gerar mapas, procedimentos, planos de ação e indicadores com apoio de inteligência artificial.`,
        "As condições comerciais (plano, valores, prazos e limites) ficam na proposta ou no contrato firmado com a consultoria ou empresa cliente, que prevalecem sobre estes termos no que forem específicos.",
      ],
    },
    {
      titulo: "2. Contas e acesso",
      paragrafos: [
        "O acesso é feito por convite de uma conta (consultoria ou empresa). Cada pessoa usa o próprio e-mail e é responsável por manter a senha em sigilo.",
        "O administrador da conta e o Consultor de cada empresa definem quem acessa e com qual perfil, e respondem pelos convites que fazem.",
      ],
    },
    {
      titulo: "3. Uso permitido",
      paragrafos: [
        "É proibido: tentar acessar dados de outras empresas, contornar limites ou controles de acesso, enviar código malicioso, usar a plataforma para fins ilícitos ou inserir dados pessoais sensíveis sem necessidade e base legal.",
      ],
    },
    {
      titulo: "4. Conteúdo da empresa cliente",
      paragrafos: [
        "O conteúdo registrado (processos, entrevistas, documentos, logos e anexos) pertence à empresa cliente. O Peter o usa apenas para prestar o serviço.",
        "A empresa cliente garante que pode usar esse conteúdo, incluindo dados de colaboradores e marcas, e que informou seus colaboradores sobre o tratamento.",
      ],
    },
    {
      titulo: "5. Inteligência artificial",
      paragrafos: [
        "Os textos e mapas gerados pela inteligência artificial são sugestões e podem conter erros ou lacunas. Revise-os antes de aprovar, publicar ou usar em auditorias. O Peter não substitui a análise da consultoria nem orientação jurídica.",
      ],
    },
    {
      titulo: "6. Propriedade intelectual",
      paragrafos: [
        "A plataforma, a marca Peter, a metodologia e os modelos de documento são de propriedade de seus titulares. A empresa cliente pode usar livremente os documentos gerados a partir do seu conteúdo.",
      ],
    },
    {
      titulo: "7. Disponibilidade e suporte",
      paragrafos: [
        "Trabalhamos para manter o Peter disponível, mas podem ocorrer interrupções para manutenção ou por falhas de fornecedores. Níveis de serviço específicos, se houver, constam do contrato.",
      ],
    },
    {
      titulo: "8. Suspensão, cancelamento e dados",
      paragrafos: [
        "O acesso pode ser suspenso em caso de uso indevido, risco à segurança ou falta de pagamento, conforme o contrato.",
        "Cancelamento e reembolso seguem a proposta ou o contrato [condições a definir]. Ao término, a empresa cliente pode exportar seus dados no prazo previsto na Política de privacidade; depois, eles são excluídos.",
      ],
    },
    {
      titulo: "9. Responsabilidade",
      paragrafos: [
        "O Peter responde pelos danos que causar na prestação do serviço, nos limites do contrato e da lei. Não responde por decisões tomadas a partir de conteúdo gerado sem revisão, nem por conteúdo inserido pela empresa cliente.",
      ],
    },
    {
      titulo: "10. Alterações, lei e foro",
      paragrafos: [
        "Mudanças relevantes nestes termos serão avisadas na plataforma e pedirão novo aceite.",
        `Aplica-se a lei brasileira. Fica eleito o foro de ${e.foro}.`,
        `Contato: ${e.email}.`,
      ],
    },
  ],
};
