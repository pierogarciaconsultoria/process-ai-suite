import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ArrowRight,
  Bot,
  FileText,
  Zap,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      {/* SEÇÃO 1 - HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 py-20 bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02]" />
        <div className="relative z-10 max-w-4xl space-y-8 animate-fade-in">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            Sua empresa não está travada por falta de esforço.{" "}
            <span className="text-primary block mt-2">Está travada por falta de processo.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Organize, padronize e escale sua operação com a Inteligência Artificial que elimina o retrabalho, mapeia seu negócio em minutos e devolve o seu tempo.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 text-left max-w-lg mx-auto py-6">
            <ul className="space-y-3 font-medium">
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Mapeamento inteligente sem planilhas
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Operação autônoma e independente
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Crescimento mensurável e previsível
              </li>
            </ul>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" className="h-14 px-8 text-lg w-full sm:w-auto" onClick={() => navigate("/dashboard")}>
              Organizar minha operação agora <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg w-full sm:w-auto" onClick={() => document.getElementById("diagnostico")?.scrollIntoView({ behavior: "smooth" })}>
              Ver a IA em ação <ChevronDown className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* SEÇÃO 2 - DIAGNÓSTICO E DOR */}
      <section id="diagnostico" className="py-24 bg-card/50">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-12">
          <div className="space-y-4 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold">O problema não é visível. Mas o impacto é.</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Sua equipe trabalha muito, mas produz pouco. Você cresce, mas a operação se torna um caos. Sem perceber, você virou o gargalo da própria empresa.
            </p>
          </div>

          <div className="bg-background border shadow-sm rounded-2xl p-8 max-w-2xl mx-auto text-left hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Identifica 2 ou mais itens abaixo? Seu problema é processo:
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                "Falhas operacionais frequentes",
                "Dependência de pessoas-chave",
                "Zero padrão nas entregas",
                "Retrabalho constante",
                "Tentativa dolorosa de escalar",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 h-5 w-5 rounded border border-muted-foreground/30 flex-shrink-0" />
                  <span className="text-muted-foreground leading-tight">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-8 pt-6 border-t font-medium text-center text-lg">
              Gargalos operacionais nunca são óbvios — mas sempre custam caro.
            </p>
          </div>
        </div>
      </section>

      {/* SEÇÃO 3 - SOLUÇÃO */}
      <section className="py-24 px-6 bg-primary/5">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl md:text-5xl font-bold">Gestão BPM combinada com IA</h2>
            <p className="text-lg text-muted-foreground">
              O ProcessAI Suite não é só mais uma ferramenta de tarefas. É o motor inteligente criado para transformar operações desorganizadas sem que você precise desenhar fluxogramas do zero.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-background p-6 rounded-2xl shadow-sm border hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Entrevista por IA</h3>
              <p className="text-muted-foreground text-sm">O sistema extrai suas rotinas usando apenas uma conversa guiada e inteligente.</p>
            </div>
            <div className="bg-background p-6 rounded-2xl shadow-sm border hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Padronização</h3>
              <p className="text-muted-foreground text-sm">Manuais, etapas e procedimentos documentados e prontos para sua equipe seguir.</p>
            </div>
            <div className="bg-background p-6 rounded-2xl shadow-sm border hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Visão Clínica</h3>
              <p className="text-muted-foreground text-sm">Diagnósticos automáticos que apontam exatamente onde estão seus gargalos de custo.</p>
            </div>
            <div className="bg-background p-6 rounded-2xl shadow-sm border hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Ação Imediata</h3>
              <p className="text-muted-foreground text-sm">Planos de ação 5W2H gerados sob medida para alavancar a eficiência contínua.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 4 - ANTES E DEPOIS */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto space-y-12">
          <h2 className="text-3xl md:text-5xl font-bold text-center">A diferença entre o esforço e o processo</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="border border-destructive/20 bg-destructive/5 rounded-2xl p-8 space-y-6">
              <div className="flex items-center gap-3 text-destructive font-semibold text-xl">
                <AlertTriangle className="h-6 w-6" /> Antes
              </div>
              <ul className="space-y-4">
                <li className="flex gap-3 text-muted-foreground"><XIcon /> Caos operacional e incêndios diários</li>
                <li className="flex gap-3 text-muted-foreground"><XIcon /> Centralização absoluta no dono</li>
                <li className="flex gap-3 text-muted-foreground"><XIcon /> Retrabalho e margem de lucro baixa</li>
                <li className="flex gap-3 text-muted-foreground"><XIcon /> Crescimento doloroso e instável</li>
              </ul>
            </div>
            <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-8 space-y-6">
              <div className="flex items-center gap-3 text-emerald-600 font-semibold text-xl dark:text-emerald-400">
                <TrendingUp className="h-6 w-6" /> Depois
              </div>
              <ul className="space-y-4">
                <li className="flex gap-3 text-foreground font-medium"><CheckIcon className="text-emerald-500" /> Processos claros e esteira azeitada</li>
                <li className="flex gap-3 text-foreground font-medium"><CheckIcon className="text-emerald-500" /> Empresa funcionando de forma autônoma</li>
                <li className="flex gap-3 text-foreground font-medium"><CheckIcon className="text-emerald-500" /> Execução padronizada por toda equipe</li>
                <li className="flex gap-3 text-foreground font-medium"><CheckIcon className="text-emerald-500" /> Escala com controle e previsibilidade</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 5 - COMO FUNCIONA */}
      <section className="py-24 bg-card border-y">
        <div className="max-w-6xl mx-auto px-6 space-y-16">
          <div className="text-center">
            <h2 className="text-3xl md:text-5xl font-bold">Organizar a casa nunca foi tão rápido.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: "A IA Te Entrevista", desc: "Nossa tecnologia conduz perguntas cirúrgicas e captura o DNA da operação." },
              { title: "Diagnóstico Automático", desc: "Descubra em segundos as falhas, riscos e maturidade do seu fluxo." },
              { title: "Receita de Execução", desc: "O sistema entrega o plano de ação pronto e estruturado para aplicar." },
              { title: "Evolução Contínua", desc: "Sua empresa padronizada, documentada e finalmente pronta para escalar." },
            ].map((step, i) => (
              <div key={i} className="relative space-y-4">
                <div className="text-6xl font-black text-primary/10">0{i + 1}</div>
                <h3 className="text-xl font-bold">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO 6 - CTA FINAL */}
      <section className="py-32 px-6 bg-zinc-950 dark:bg-zinc-900 text-zinc-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full w-1/2 h-1/2 left-1/4 top-1/4 pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold leading-tight">
            Se a sua empresa depende de você para funcionar, amanhã não será crescimento. <span className="text-primary">Será um risco.</span>
          </h2>
          <p className="text-zinc-400 text-xl">Experimente o sistema que devolve o seu tempo.</p>
          <div className="pt-8">
            <Button size="lg" className="h-14 px-10 text-lg w-full sm:w-auto" onClick={() => navigate("/dashboard")}>
              Parar de apagar incêndios agora <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x h-5 w-5 shrink-0">
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-check h-5 w-5 shrink-0 ${className || ""}`}>
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  );
}
