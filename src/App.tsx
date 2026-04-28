import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import SupportWidget from "@/components/SupportWidget";
const Login = React.lazy(() => import("./pages/Login"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const Landing = React.lazy(() => import("./pages/Landing"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Empresas = React.lazy(() => import("./pages/Empresas"));
const Processos = React.lazy(() => import("./pages/Processos"));
const ProcessoNovo = React.lazy(() => import("./pages/ProcessoNovo"));
const ProcessoFormulario = React.lazy(() => import("./pages/ProcessoFormulario"));
const ProcessoDetalhe = React.lazy(() => import("./pages/ProcessoDetalhe"));
const ProcessoDiagnostico = React.lazy(() => import("./pages/ProcessoDiagnostico"));
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
const ConfigDocumentacaoProcesso = React.lazy(() => import("./pages/ConfigDocumentacaoProcesso"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const EntrevistaProcesso = React.lazy(() => import("./pages/EntrevistaProcesso"));

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
              <Route path="/" element={<Landing />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/empresas" element={<Empresas />} />
                <Route path="/processos" element={<Processos />} />
                <Route path="/processos/novo" element={<ProcessoNovo />} />
                <Route path="/processos/novo/formulario" element={<ProcessoFormulario />} />
                <Route path="/processos/novo/entrevista" element={<EntrevistaProcesso />} />
                <Route path="/processos/entrevista" element={<Navigate to="/processos/novo/entrevista" replace />} />
                <Route path="/processos/diagnostico" element={<ProcessoDiagnostico />} />
                <Route path="/processos/:id" element={<ProcessoDetalhe />} />
              <Route path="/processos/:id/editar" element={<ProcessoFormulario />} />
              <Route path="/processos/:id/diagnostico" element={<ProcessoDiagnostico />} />
                <Route path="/arquitetura" element={<Arquitetura />} />
              <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/configuracoes/empresas" element={<Empresas />} />
              <Route path="/configuracoes/usuarios" element={<Usuarios />} />
              <Route path="/configuracoes/perfil" element={<ConfigPerfil />} />
              <Route path="/configuracoes/alterar-senha" element={<ConfigAlterarSenha />} />
              <Route path="/configuracoes/roteiro-entrevista" element={<ConfigRoteiroEntrevista />} />
              <Route path="/configuracoes/skin-ia" element={<ConfigSkinIA />} />
              <Route path="/configuracoes/documentacao-processo" element={<ConfigDocumentacaoProcesso />} />
              <Route path="/configuracoes/chamados" element={<ConfigChamados />} />
              <Route path="/configuracoes/chamados/:id" element={<ChamadoDetalhe />} />
              <Route path="/usuarios" element={<Navigate to="/configuracoes/usuarios" replace />} />
              <Route path="/empresas" element={<Navigate to="/configuracoes/empresas" replace />} />
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
