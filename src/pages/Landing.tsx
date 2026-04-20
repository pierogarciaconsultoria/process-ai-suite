import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network, Building2, ClipboardList, Sparkles, Users, ShieldCheck, Gauge, FileText, Lock, Settings } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Network className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Process Intelligence</h1>
              <p className="text-xs text-muted-foreground">Plataforma multi-empresa</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/login")} className="no-print">
              Entrar
            </Button>
            <Button onClick={() => navigate("/login?mode=signup")} className="no-print">
              Criar conta
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="space-y-6">
          <Badge className="w-fit" variant="secondary">Multi-empresa</Badge>
          <h2 className="text-4xl font-bold tracking-tight">
            Orquestre processos, meça maturidade digital e evolua com IA
          </h2>
          <p className="text-muted-foreground max-w-3xl">
            Mapeie atividades, identifique gargalos e gere diagnósticos automáticos na escala 0–4.
            Plataforma preparada para múltiplas empresas, usuários e perfis.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/processos")}>
              Ver funcionalidades
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-6">
            <Card className="h-full">
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Empresas e usuários</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Estruture múltiplas empresas, times e perfis de acesso.
              </CardContent>
            </Card>
            <Card className="h-full">
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Diagnóstico 0–4</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Classificação automática e proposta de evolução do processo.
              </CardContent>
            </Card>
            <Card className="h-full">
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">IA aplicada</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Geração de relatório e mapa BPMN com suporte de IA.
              </CardContent>
            </Card>
            <Card className="h-full">
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Users className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Perfis de acesso</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Convide usuários e defina perfis (admin, gestor, analista).
              </CardContent>
            </Card>
            <Card className="h-full">
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Relatórios com IA</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Gere diagnósticos e PDF de forma automática para sua empresa.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-12 space-y-12">
        <div className="space-y-4">
          <Badge variant="secondary">Funcionalidades</Badge>
          <h3 className="text-2xl font-bold tracking-tight">O que você consegue fazer com a plataforma</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Multi-empresa e times</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Estruture múltiplas empresas, convide usuários e organize perfis de acesso (admin, gestor, analista).
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Formulário de processo</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Coleta estruturada em SIPOC, atividades, decisões, entradas/saídas, riscos, indicadores e plano de ação.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Diagnóstico com IA (0–4)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Classificação automática de maturidade, detecção de gargalos e recomendações de evolução do processo.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Gauge className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Indicadores e métricas</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Definição de KPIs, metas e acompanhamento da criticidade detalhada por impacto, risco e cliente.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <FileText className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Relatórios e mapas</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Geração de PDF e mapa BPMN 2.0 com diagrama visual, prontos para compartilhar com a diretoria.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Segurança com RLS</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Isolamento por usuário/empresa usando políticas de segurança no banco (Supabase RLS).
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <Badge variant="secondary">Módulos do Sistema</Badge>
          <h3 className="text-2xl font-bold tracking-tight">Arquitetura de módulos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Processos</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Cadastro, formulário, diagnóstico com IA e modelagem BPMN 2.0.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Users className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Usuários e Perfis</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Convites por empresa, perfis de acesso e gestão de membros.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Empresas</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Onboarding de organização, estrutura por segmento e tamanho.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <FileText className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Relatórios</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Geração automática de relatórios executivos e exportações.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Settings className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Configurações</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Preferências, segurança e integrações opcionais de IA.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Network className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Arquitetura</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Visualização de processos, fluxos e relação entre módulos.
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <Badge variant="secondary">Requisitos e Segurança</Badge>
          <h3 className="text-2xl font-bold tracking-tight">Antes de começar</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Lock className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Isolamento de dados</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Políticas RLS garantem que cada usuário acesse apenas dados da sua empresa e dos seus vínculos.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-secondary-foreground" />
                </div>
                <CardTitle className="text-base">Pré-requisitos</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Conta Supabase configurada, envio de e-mails habilitado e, opcionalmente, chave de IA para BPMN e relatórios.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Process Intelligence — Plataforma multi-empresa
        </div>
      </footer>
    </div>
  );
}
