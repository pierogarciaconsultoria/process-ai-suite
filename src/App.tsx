import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import { ConsultorRoute } from "@/components/ConsultorRoute";
import SupportWidget from "@/components/SupportWidget";
const Login = React.lazy(() => import("./pages/Login"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const ConviteAceite = React.lazy(() => import("./pages/ConviteAceite.tsx"));
const Landing = React.lazy(() => import("./pages/Landing"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Empresas = React.lazy(() => import("./pages/Empresas"));
const Processos = React.lazy(() => import("./pages/Processos"));
const ProcessoDetalhe = React.lazy(() => import("./pages/ProcessoDetalhe"));
const Documentos = React.lazy(() => import("./pages/Documentos"));
const Arquitetura = React.lazy(() => import("./pages/Arquitetura"));
const Usuarios = React.lazy(() => import("./pages/Usuarios"));
const Relatorios = React.lazy(() => import("./pages/Relatorios"));
const Configuracoes = React.lazy(() => import("./pages/Configuracoes"));
const ConfigPerfil = React.lazy(() => import("./pages/ConfigPerfil"));
const ConfigAlterarSenha = React.lazy(() => import("./pages/ConfigAlterarSenha"));
const ConfigChamados = React.lazy(() => import("./pages/ConfigChamados"));
const ChamadoDetalhe = React.lazy(() => import("./pages/ChamadoDetalhe"));
const ConfigRoteiroEntrevista = React.lazy(() => import("./pages/ConfigRoteiroEntrevista"));
const ConfigSkinIA = React.lazy(() => import("./pages/ConfigSkinIA"));
const ConfigContas = React.lazy(() => import("./pages/ConfigContas"));
const ConfigDocumentacaoProcesso = React.lazy(() => import("./pages/ConfigDocumentacaoProcesso"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const EntrevistaProcesso = React.lazy(() => import("./pages/EntrevistaProcesso"));
const ProcessoResultadoGuiado = React.lazy(() => import("./pages/ProcessoResultadoGuiado"));
const ProcessoMapa = React.lazy(() => import("./pages/ProcessoMapa"));
const PlanoDeAcao = React.lazy(() => import("./pages/PlanoDeAcao"));
const Indicadores = React.lazy(() => import("./pages/Indicadores"));
const PeterChat = React.lazy(() => import("./pages/PeterChat"));
const MinhasEmpresas = React.lazy(() => import("./pages/MinhasEmpresas"));

// O formulário e o diagnóstico antigos deram lugar à página do processo, que edita por seção.
function ParaPaginaDoProcesso() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/processos/${id}`} replace />;
}

const queryClient = new QueryClient();

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Erro de renderização:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center">
            <div className="mb-4 text-destructive text-4xl">!</div>
            <h1 className="text-xl font-semibold">Erro de renderização</h1>
            <p className="mt-2 text-muted-foreground">{this.state.error?.message ?? "Falha ao renderizar a aplicação."}</p>
          </div>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <div className="sr-only">App carregado</div>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
        <BrowserRouter>
          <React.Suspense fallback={<div className="p-6">Carregando...</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/convite/:token" element={<ConviteAceite />} />
              <Route path="/" element={<Landing />} />
              <Route element={<AppLayout />}>
                <Route path="/inicio" element={<PeterChat />} />
                <Route path="/minhas-empresas" element={<Navigate to="/configuracoes/minhas-empresas" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/empresas" element={<Empresas />} />
                <Route path="/processos" element={<Processos />} />
                <Route path="/processos/novo" element={<Navigate to="/processos/novo/entrevista" replace state={{ guidedExperience: true }} />} />
                <Route path="/processos/novo/formulario" element={<Navigate to="/processos/novo/entrevista" replace state={{ guidedExperience: true }} />} />
                <Route path="/processos/novo/entrevista" element={<EntrevistaProcesso />} />
                <Route path="/processos/:id/entrevista" element={<EntrevistaProcesso />} />
                <Route path="/processos/:id/resultado-guiado" element={<ProcessoResultadoGuiado />} />
                <Route path="/processos/:id/mapa" element={<ProcessoMapa />} />
                <Route path="/processos/entrevista" element={<Navigate to="/processos/novo/entrevista" replace />} />
                <Route path="/processos/diagnostico" element={<Navigate to="/processos" replace />} />
                <Route path="/processos/:id" element={<ProcessoDetalhe />} />
                <Route path="/documentos" element={<Documentos />} />
                <Route path="/plano-de-acao" element={<PlanoDeAcao />} />
                <Route path="/indicadores" element={<Indicadores />} />
              <Route path="/processos/:id/editar" element={<ParaPaginaDoProcesso />} />
              <Route path="/processos/:id/diagnostico" element={<ParaPaginaDoProcesso />} />
                <Route path="/arquitetura" element={<Arquitetura />} />
              <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/configuracoes/minhas-empresas" element={<ConsultorRoute><MinhasEmpresas /></ConsultorRoute>} />
              <Route path="/configuracoes/contas" element={<SuperAdminRoute><ConfigContas /></SuperAdminRoute>} />
              <Route path="/configuracoes/empresas" element={<Empresas />} />
              <Route path="/configuracoes/usuarios" element={<Usuarios />} />
              <Route path="/configuracoes/perfil" element={<ConfigPerfil />} />
              <Route path="/configuracoes/alterar-senha" element={<ConfigAlterarSenha />} />
              <Route path="/configuracoes/roteiro-entrevista" element={<SuperAdminRoute><ConfigRoteiroEntrevista /></SuperAdminRoute>} />
              <Route path="/configuracoes/skin-ia" element={<SuperAdminRoute><ConfigSkinIA /></SuperAdminRoute>} />
              <Route path="/configuracoes/documentacao-processo" element={<SuperAdminRoute><ConfigDocumentacaoProcesso /></SuperAdminRoute>} />
              <Route path="/configuracoes/chamados" element={<ConfigChamados />} />
              <Route path="/configuracoes/chamados/:id" element={<ChamadoDetalhe />} />
              <Route path="/usuarios" element={<Navigate to="/configuracoes/usuarios" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </React.Suspense>
        </BrowserRouter>
        <SupportWidget />
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
