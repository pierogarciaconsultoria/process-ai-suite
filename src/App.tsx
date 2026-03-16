import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Empresas from "./pages/Empresas";
import Processos from "./pages/Processos";
import ProcessoFormulario from "./pages/ProcessoFormulario";
import ProcessoDetalhe from "./pages/ProcessoDetalhe";
import Arquitetura from "./pages/Arquitetura";
import Usuarios from "./pages/Usuarios";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/empresas" element={<Empresas />} />
            <Route path="/processos" element={<Processos />} />
            <Route path="/processos/novo" element={<ProcessoFormulario />} />
            <Route path="/processos/:id" element={<ProcessoDetalhe />} />
            <Route path="/arquitetura" element={<Arquitetura />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
