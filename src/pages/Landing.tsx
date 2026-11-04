import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, FileText, Mail, MessageSquare, Network, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// A ferramenta em três passos: entrevista com o Peter → mapa AS IS / TO BE → relatório.
const PASSOS = [
  {
    icone: MessageSquare,
    titulo: "Converse com o Peter",
    texto:
      "Ele faz perguntas simples, uma de cada vez, sobre como o processo funciona hoje. Se você já tem um diagrama .bpmn, um documento ou uma anotação, anexe: o Peter aproveita o que está escrito e só pergunta o que falta.",
  },
  {
    icone: Workflow,
    titulo: "Ajuste o mapa",
    texto:
      "O mapa do processo atual (AS IS) e o do processo melhorado (TO BE) ficam num editor BPMN dentro da plataforma. Mude o que quiser, arrastando e soltando.",
  },
  {
    icone: FileText,
    titulo: "Receba o relatório",
    texto:
      "SIPOC, atividades, diagnóstico e plano de ação 5W2H num relatório pronto para PDF, e o procedimento (PR ou IT) já escrito para revisão.",
  },
];

const GARANTIAS = [
  "Não precisa saber BPMN nem gestão de processos.",
  "O Peter não inventa: o que você não informou aparece como [a definir].",
  "Qualquer seção do relatório pode ser corrigida em poucos cliques.",
  "Os dados de cada empresa ficam separados das demais.",
];

export default function Landing() {
  const navigate = useNavigate();
  const criarConta = () => navigate("/login?mode=signup");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary">
              <Network className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-foreground">Process Intelligence</h1>
              <p className="text-xs text-muted-foreground">by Piero Garcia</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/login")}>Entrar</Button>
            <Button onClick={criarConta} className="hidden sm:inline-flex">Criar conta</Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-3xl space-y-6">
            <Badge variant="secondary" className="w-fit">Mapeamento de processos com IA</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Mapeie um processo conversando. Receba o mapa e o relatório prontos.
            </h2>
            <p className="text-lg text-muted-foreground">
              O Peter conduz a entrevista em linguagem simples, desenha o mapa do processo e propõe as melhorias.
              Você revisa, ajusta o que quiser e baixa o relatório.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={criarConta}>
                Começar agora <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/login")}>Já tenho conta</Button>
            </div>
          </div>
        </section>

        <section className="border-y bg-card/50">
          <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6">
            <h3 className="text-2xl font-bold tracking-tight text-foreground">Como funciona</h3>
            <ol className="grid gap-4 md:grid-cols-3">
              {PASSOS.map((passo, indice) => (
                <li key={passo.titulo}>
                  <Card className="h-full">
                    <CardHeader className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                          {indice + 1}
                        </span>
                        <passo.icone className="h-5 w-5 text-primary" aria-hidden />
                      </div>
                      <CardTitle className="text-lg">{passo.titulo}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm leading-6 text-muted-foreground">{passo.texto}</CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div className="space-y-3">
            <h3 className="text-2xl font-bold tracking-tight text-foreground">Simples para quem conta, sério para quem usa</h3>
            <p className="text-muted-foreground">
              Quem conhece o processo só precisa contar como ele funciona. O resultado segue a linguagem da gestão por
              processos e da ISO 9001, pronto para apresentar à diretoria.
            </p>
          </div>
          <ul className="space-y-3">
            {GARANTIAS.map((garantia) => (
              <li key={garantia} className="flex gap-3 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{garantia}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="flex flex-col items-start gap-4 rounded-2xl bg-primary px-6 py-8 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <div>
              <h3 className="text-xl font-bold">Mapeie o primeiro processo hoje</h3>
              <p className="text-sm opacity-90">Crie a conta, chame o Peter e conte como o processo funciona.</p>
            </div>
            <Button size="lg" variant="secondary" onClick={criarConta}>
              Criar conta <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Process Intelligence · Piero Garcia Consultoria</span>
          <a href="mailto:contato@pierogarcia.com.br" className="inline-flex items-center gap-2 hover:text-foreground hover:underline">
            <Mail className="h-4 w-4" aria-hidden /> contato@pierogarcia.com.br
          </a>
        </div>
      </footer>
    </div>
  );
}
