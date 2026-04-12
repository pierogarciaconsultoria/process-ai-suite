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
  Menu,
  X,
  Play,
  Shield,
  BarChart3,
  Users,
  Clock,
  Star,
} from "lucide-react";
import { useState, useEffect } from "react";

export default function Index() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-[#f0f7f7] text-[#002B2B] font-sans overflow-x-hidden">

      {/* ───── NAVBAR ───── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-white/90 backdrop-blur-md shadow-sm" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-xl text-[#006B6B]">
            <div className="h-8 w-8 rounded-lg bg-[#006B6B] flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            Process<span className="text-[#002B2B]">AI</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#004444]">
            <button onClick={() => scrollTo("diagnostico")} className="hover:text-[#006B6B] transition-colors">Diagnóstico</button>
            <button onClick={() => scrollTo("solucao")} className="hover:text-[#006B6B] transition-colors">Solução</button>
            <button onClick={() => scrollTo("como-funciona")} className="hover:text-[#006B6B] transition-colors">Como funciona</button>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="hidden md:flex text-[#006B6B] hover:bg-[#006B6B]/10" onClick={() => navigate("/dashboard")}>
              Entrar
            </Button>
            <Button size="sm" className="bg-[#006B6B] hover:bg-[#005555] text-white hidden md:flex" onClick={() => navigate("/dashboard")}>
              Começar grátis <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-white border-t px-6 py-4 space-y-4">
            <button onClick={() => { scrollTo("diagnostico"); setMobileOpen(false); }} className="block w-full text-left py-2 font-medium">Diagnóstico</button>
            <button onClick={() => { scrollTo("solucao"); setMobileOpen(false); }} className="block w-full text-left py-2 font-medium">Solução</button>
            <button onClick={() => { scrollTo("como-funciona"); setMobileOpen(false); }} className="block w-full text-left py-2 font-medium">Como funciona</button>
            <Button className="w-full bg-[#006B6B] text-white mt-2" onClick={() => navigate("/dashboard")}>Começar agora</Button>
          </div>
        )}
      </header>

      {/* ───── HERO ───── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 overflow-hidden">

        {/* Background decorativo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#006B6B]/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#006B6B]/5 rounded-full blur-[90px]" />
          {/* Grade sutil */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(#006B6B 1px, transparent 1px), linear-gradient(90deg, #006B6B 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div className="relative z-10 max-w-5xl space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#006B6B]/10 border border-[#006B6B]/20 text-[#006B6B] rounded-full px-4 py-1.5 text-sm font-semibold">
            <Zap className="h-3.5 w-3.5" />
            Powered by Inteligência Artificial
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05]">
            Sua empresa não está travada
            <br />por falta de esforço.
            <br />
            <span className="relative inline-block mt-2">
              <span className="text-[#006B6B]">Está travada por falta de processo.</span>
              <svg className="absolute -bottom-2 left-0 w-full" height="8" viewBox="0 0 100 8" preserveAspectRatio="none">
                <path d="M0 7 Q50 1 100 7" stroke="#006B6B" strokeWidth="2" fill="none" opacity="0.4" />
              </svg>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-[#004444]/70 max-w-3xl mx-auto leading-relaxed">
            Organize, padronize e escale sua operação com a IA que elimina o retrabalho,{" "}
            <strong className="text-[#006B6B] font-semibold">mapeia seu negócio em minutos</strong> e devolve o seu tempo.
          </p>

          {/* Feature cards horizontais abaixo da headline */}
          <div className="w-full overflow-x-auto pb-1 -mb-1">
            <div className="flex gap-3 pt-4 min-w-max mx-auto md:min-w-0 md:grid md:grid-cols-4">
              {[
                { icon: <Bot className="h-5 w-5" />, title: "Entrevista por IA", desc: "Mapeia via conversa" },
                { icon: <FileText className="h-5 w-5" />, title: "Padronização", desc: "Manuais automáticos" },
                { icon: <BarChart3 className="h-5 w-5" />, title: "Diagnóstico", desc: "Gargalos em segundos" },
                { icon: <Shield className="h-5 w-5" />, title: "Plano de Ação", desc: "5W2H automático" },
              ].map((card, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white/70 backdrop-blur-sm border border-[#006B6B]/15 rounded-xl px-4 py-3 text-left hover:bg-white hover:border-[#006B6B]/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default flex-shrink-0 md:flex-shrink"
                >
                  <div className="h-9 w-9 bg-[#006B6B]/10 rounded-lg flex items-center justify-center text-[#006B6B] flex-shrink-0">
                    {card.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-[#002B2B] text-sm whitespace-nowrap">{card.title}</p>
                    <p className="text-[#004444]/60 text-xs leading-snug whitespace-nowrap">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Button
              size="lg"
              className="h-14 px-10 text-base font-semibold w-full sm:w-auto bg-[#006B6B] hover:bg-[#005555] text-white shadow-xl shadow-[#006B6B]/20 hover:shadow-2xl hover:shadow-[#006B6B]/30 transition-all duration-300 hover:-translate-y-0.5"
              onClick={() => navigate("/dashboard")}
            >
              Organizar minha operação agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 text-base font-semibold w-full sm:w-auto border-[#006B6B]/30 text-[#006B6B] hover:bg-[#006B6B]/5 hover:-translate-y-0.5 transition-all duration-300"
              onClick={() => scrollTo("diagnostico")}
            >
              <Play className="mr-2 h-4 w-4 fill-current" />
              Ver como funciona
            </Button>
          </div>

          {/* Trust indicator */}
          <p className="text-sm text-[#004444]/50 pt-2">
            ✦ Sem cartão de crédito · Diagnóstico gratuito · Setup em minutos
          </p>
        </div>

        {/* Scroll caret */}
        <button
          onClick={() => scrollTo("stats")}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[#006B6B]/40 hover:text-[#006B6B] transition-colors animate-bounce"
        >
          <ChevronDown className="h-6 w-6" />
        </button>
      </section>

      {/* ───── STATS BAR ───── */}
      <section id="stats" className="bg-[#006B6B] py-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-white text-center">
          {[
            { value: "40%", label: "Redução de retrabalho", icon: <TrendingUp className="h-5 w-5" /> },
            { value: "3×", label: "Mais velocidade de escala", icon: <Zap className="h-5 w-5" /> },
            { value: "2 min", label: "Para o 1° diagnóstico", icon: <Clock className="h-5 w-5" /> },
            { value: "100%", label: "Orientado a resultado", icon: <Star className="h-5 w-5" /> },
          ].map((stat) => (
            <div key={stat.label} className="space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-white/60 text-xs font-medium uppercase tracking-wider mb-2">
                {stat.icon} {stat.label}
              </div>
              <div className="text-4xl font-black">{stat.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ───── BLOCO DE DOR ───── */}
      <section id="diagnostico" className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <p className="text-[#006B6B] font-semibold text-sm uppercase tracking-widest">O Diagnóstico</p>
            <h2 className="text-4xl md:text-5xl font-bold text-[#002B2B]">
              O problema não é visível. Mas o impacto é.
            </h2>
            <p className="text-lg text-[#004444]/70 leading-relaxed">
              Sua equipe trabalha muito, mas produz pouco. Você cresce, mas a operação se torna um caos. Sem perceber, <strong>você virou o gargalo da própria empresa.</strong>
            </p>
          </div>

          {/* Checklist card */}
          <div className="max-w-2xl mx-auto">
            <div className="relative bg-gradient-to-br from-[#002B2B] to-[#004444] rounded-3xl p-8 shadow-2xl text-white">
              <div className="absolute -top-3 left-8 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Auto-diagnóstico
              </div>
              <h3 className="text-lg font-semibold mb-6 text-white/90">
                Identifica 2 ou mais dos itens abaixo? Seu problema é processo — não equipe.
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  "Falhas operacionais frequentes",
                  "Dependência de pessoas-chave",
                  "Zero padrão nas entregas",
                  "Retrabalho que corrói o lucro",
                  "Tentativa dolorosa de escalar",
                  "Incêndios diários na operação",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 transition-colors cursor-pointer">
                    <div className="h-5 w-5 rounded border border-white/30 flex-shrink-0" />
                    <span className="text-white/80 text-sm">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <p className="text-white/60 text-sm italic">
                  "Gargalos operacionais nunca são óbvios — mas sempre custam caro."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── SOLUÇÃO ───── */}
      <section id="solucao" className="py-24 px-6 bg-[#f0f7f7]">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <p className="text-[#006B6B] font-semibold text-sm uppercase tracking-widest">A Solução</p>
            <h2 className="text-4xl md:text-5xl font-bold text-[#002B2B]">
              Gestão BPM combinada com IA
            </h2>
            <p className="text-lg text-[#004444]/70">
              O ProcessAI Suite não é só mais uma ferramenta de tarefas. É o motor inteligente que transforma operações desorganizadas em sistemas previsíveis e escaláveis — <strong>sem que você precise desenhar fluxogramas do zero.</strong>
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <Bot className="h-6 w-6" />, title: "Entrevista por IA", desc: "O sistema extrai suas rotinas via conversa guiada e inteligente. Sem formulários chatos." },
              { icon: <FileText className="h-6 w-6" />, title: "Padronização Imediata", desc: "Manuais, etapas e procedimentos documentados e prontos para sua equipe executar." },
              { icon: <BarChart3 className="h-6 w-6" />, title: "Visão Clínica", desc: "Diagnósticos automáticos apontam onde estão os gargalos que estão corroendo sua margem." },
              { icon: <Shield className="h-6 w-6" />, title: "Ação Imediata", desc: "Planos de ação 5W2H gerados sob medida para alavancar a eficiência contínua." },
            ].map((card, i) => (
              <div
                key={i}
                className="group bg-white rounded-2xl p-6 shadow-sm border border-[#006B6B]/10 hover:border-[#006B6B]/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default"
              >
                <div className="h-12 w-12 bg-[#006B6B]/10 group-hover:bg-[#006B6B] rounded-xl flex items-center justify-center mb-5 text-[#006B6B] group-hover:text-white transition-all duration-300">
                  {card.icon}
                </div>
                <h3 className="font-bold text-[#002B2B] text-lg mb-2">{card.title}</h3>
                <p className="text-[#004444]/60 text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── ANTES & DEPOIS ───── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-[#006B6B] font-semibold text-sm uppercase tracking-widest">A Transformação</p>
            <h2 className="text-4xl md:text-5xl font-bold text-[#002B2B]">A diferença entre o esforço e o processo</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Antes */}
            <div className="bg-red-50 border border-red-200/60 rounded-3xl p-8 space-y-5">
              <div className="flex items-center gap-2 text-red-600 font-bold text-lg">
                <AlertTriangle className="h-5 w-5" /> Antes — O ciclo vicioso
              </div>
              <ul className="space-y-3">
                {[
                  "Caos operacional e incêndios diários",
                  "Você é o gargalo e a empresa depende de você",
                  "Retrabalho constante corrói a margem",
                  "Crescimento amplifica o problema",
                ].map((item, i) => (
                  <li key={i} className="flex gap-3 items-start text-[#002B2B]/70">
                    <span className="mt-0.5 h-5 w-5 rounded-full bg-red-200 text-red-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Depois */}
            <div className="bg-[#006B6B]/5 border border-[#006B6B]/20 rounded-3xl p-8 space-y-5">
              <div className="flex items-center gap-2 text-[#006B6B] font-bold text-lg">
                <TrendingUp className="h-5 w-5" /> Depois — O ciclo virtuoso
              </div>
              <ul className="space-y-3">
                {[
                  "Processos claros e esteira azeitada",
                  "Empresa funcionando de forma autônoma",
                  "Execução padronizada por toda a equipe",
                  "Crescimento com controle e previsibilidade",
                ].map((item, i) => (
                  <li key={i} className="flex gap-3 items-start text-[#002B2B]">
                    <span className="mt-0.5 h-5 w-5 rounded-full bg-[#006B6B]/20 text-[#006B6B] flex items-center justify-center flex-shrink-0 text-xs font-bold">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ───── COMO FUNCIONA ───── */}
      <section id="como-funciona" className="py-24 px-6 bg-[#f0f7f7]">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <p className="text-[#006B6B] font-semibold text-sm uppercase tracking-widest">O Processo</p>
            <h2 className="text-4xl md:text-5xl font-bold text-[#002B2B]">Organizar a casa nunca foi tão rápido.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <Bot className="h-6 w-6" />, title: "A IA Te Entrevista", desc: "Perguntas cirúrgicas que capturam o DNA da sua operação numa conversa natural." },
              { icon: <BarChart3 className="h-6 w-6" />, title: "Diagnóstico Automático", desc: "Falhas, riscos e nível de maturidade identificados em segundos." },
              { icon: <FileText className="h-6 w-6" />, title: "Receita de Execução", desc: "Plano de ação pronto e estruturado para implementar imediatamente." },
              { icon: <TrendingUp className="h-6 w-6" />, title: "Evolução Contínua", desc: "Empresa padronizada, documentada e pronta para escalar sem travar." },
            ].map((step, i) => (
              <div key={i} className="relative group">
                <div className="text-[120px] font-black text-[#006B6B]/5 absolute -top-8 -left-2 leading-none select-none">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="relative space-y-4 pt-6">
                  <div className="h-12 w-12 bg-[#006B6B] text-white rounded-xl flex items-center justify-center shadow-lg shadow-[#006B6B]/20">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-bold text-[#002B2B]">{step.title}</h3>
                  <p className="text-[#004444]/60 leading-relaxed text-sm">{step.desc}</p>
                </div>
                {i < 3 && (
                  <div className="hidden lg:block absolute top-12 -right-4 text-[#006B6B]/20 text-2xl font-light">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── PROVA SOCIAL (placeholder) ───── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <p className="text-[#006B6B] font-semibold text-sm uppercase tracking-widest">Resultados</p>
          <h2 className="text-4xl font-bold text-[#002B2B]">Não é teoria. É operação funcionando.</h2>
          <p className="text-[#004444]/70 max-w-xl mx-auto">Aplicado em empresas reais que precisavam organizar, reduzir falhas e ganhar produtividade.</p>
          <div className="grid sm:grid-cols-3 gap-6 mt-8">
            {[
              { icon: <Users className="h-8 w-8" />, title: "Empresas atendidas", value: "50+" },
              { icon: <Clock className="h-8 w-8" />, title: "Horas economizadas", value: "2.000+" },
              { icon: <CheckCircle2 className="h-8 w-8" />, title: "Processos mapeados", value: "300+" },
            ].map((stat) => (
              <div key={stat.title} className="bg-[#f0f7f7] rounded-2xl p-8 text-center border border-[#006B6B]/10">
                <div className="text-[#006B6B] mb-3 flex justify-center">{stat.icon}</div>
                <div className="text-4xl font-black text-[#002B2B] mb-1">{stat.value}</div>
                <div className="text-[#004444]/60 text-sm">{stat.title}</div>
              </div>
            ))}
          </div>
          <div className="mt-10 border border-dashed border-[#006B6B]/30 rounded-2xl p-10 text-[#004444]/40 text-sm">
            📸 Espaço reservado para inserir depoimentos, prints e cases de sucesso
          </div>
        </div>
      </section>

      {/* ───── CTA FINAL ───── */}
      <section className="py-32 px-6 bg-[#002B2B] text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#006B6B]/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#006B6B]/10 rounded-full blur-[90px]" />
        </div>
        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm font-semibold text-white/80">
            <Shield className="h-3.5 w-3.5" /> Comece hoje, sem risco
          </div>
          <h2 className="text-4xl md:text-6xl font-extrabold leading-tight">
            Se sua empresa depende de você para funcionar,{" "}
            <span className="text-[#4DBBBB]">isso não é crescimento. É risco.</span>
          </h2>
          <p className="text-white/60 text-xl max-w-2xl mx-auto">
            Experimente o sistema que devolve o seu tempo e transforma o caos em processo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Button
              size="lg"
              className="h-14 px-10 text-base font-bold w-full sm:w-auto bg-[#006B6B] hover:bg-[#005555] text-white shadow-2xl shadow-[#006B6B]/30 hover:-translate-y-1 transition-all duration-300"
              onClick={() => navigate("/dashboard")}
            >
              Quero organizar minha operação agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
          <p className="text-white/30 text-sm">Começar diagnóstico gratuito · Sem cartão de crédito</p>
        </div>
      </section>

      {/* ───── FOOTER minimal ───── */}
      <footer className="bg-[#001A1A] py-8 px-6 text-center text-white/30 text-sm">
        <div className="flex items-center justify-center gap-2 font-bold text-white/50 mb-2">
          <div className="h-6 w-6 rounded bg-[#006B6B] flex items-center justify-center">
            <Bot className="h-3 w-3 text-white" />
          </div>
          ProcessAI Suite
        </div>
        © {new Date().getFullYear()} ProcessAI Suite. Todos os direitos reservados.
      </footer>
    </div>
  );
}
