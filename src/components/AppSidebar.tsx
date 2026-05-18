import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Network,
  ClipboardList,
  FileText,
  Settings,
  LogOut,
  Building2,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Processos", url: "/processos", icon: ClipboardList },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
];

const configItems = [{ title: "Configurações", url: "/configuracoes", icon: Settings }];

type EmpresaOption = {
  id: string;
  nome: string;
  segmento?: string | null;
  logo_url?: string | null;
  perfil?: string;
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname.startsWith(path);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    try {
      const stored = window.localStorage.getItem("process:activeEmpresaId");
      return stored || undefined;
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    let isMounted = true;
    let inFlight: Promise<void> | null = null;

    const runLoad = async (session: Session | null) => {
      if (!isMounted) return;
      if (!session?.user) {
        setEmpresas([]);
        setLoadingEmpresas(false);
        return;
      }
      setLoadingEmpresas(true);
      const { data, error } = await supabase.functions.invoke("org-list");
      if (!isMounted) return;
      if (error || !Array.isArray(data)) {
        setEmpresas([]);
        setLoadingEmpresas(false);
        return;
      }
      const seen = new Set<string>();
      const list = (data as Array<Record<string, unknown>>)
        .map((e) => ({
          id: String(e.id),
          nome: String(e.nome),
          segmento: e.segmento == null ? null : String(e.segmento),
          logo_url: e.logo_url == null ? null : String(e.logo_url),
          perfil: e.perfil == null ? undefined : String(e.perfil),
        }))
        .filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
      setEmpresas(list);
      setLoadingEmpresas(false);
      if (list.length === 0) return;
      setEmpresaId((prev) => {
        const exists = prev && list.some((e) => e.id === prev);
        const nextId = exists ? prev! : list[0].id;
        try {
          window.localStorage.setItem("process:activeEmpresaId", nextId);
          const nome = list.find((e) => e.id === nextId)?.nome ?? "";
          window.localStorage.setItem("process:activeEmpresaNome", nome);
        } catch (err) {
          void err;
        }
        return nextId;
      });
    };

    const loadEmpresas = (session: Session | null) => {
      const prev = inFlight ?? Promise.resolve();
      const next = prev.then(() => runLoad(session));
      inFlight = next.finally(() => {
        if (inFlight === next) inFlight = null;
      });
      return inFlight;
    };

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      await loadEmpresas(data.session);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadEmpresas(session);
    });

    const handleRefresh = () => {
      void supabase.auth.getSession().then(({ data }) => loadEmpresas(data.session));
    };
    window.addEventListener("empresas:refresh", handleRefresh);

    void bootstrap();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      window.removeEventListener("empresas:refresh", handleRefresh);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        {!collapsed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent">
                <Network className="h-5 w-5 text-sidebar-accent-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-sidebar-foreground">
                  Process Intelligence
                </h2>
                <p className="text-[10px] text-sidebar-foreground/60">by Piero Garcia</p>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-[0.08em] text-sidebar-foreground/60 flex items-center gap-1">
                <Building2 className="h-[0.7rem] w-[0.7rem]" />
                Empresa atual
              </Label>
              <Select
                value={empresaId}
                onValueChange={(value) => {
                  setEmpresaId(value);
                  try {
                    window.localStorage.setItem("process:activeEmpresaId", value);
                    const nome = empresas.find((e) => e.id === value)?.nome ?? "";
                    window.localStorage.setItem("process:activeEmpresaNome", nome);
                  } catch (err) {
                    void err;
                  }
                }}
              >
                <SelectTrigger className="h-8 px-2 text-xs">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {loadingEmpresas ? (
                    <SelectItem value="__loading__" disabled>
                      Carregando empresas...
                    </SelectItem>
                  ) : empresas.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      Nenhuma empresa cadastrada
                    </SelectItem>
                  ) : (
                    empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent">
              <Network className="h-5 w-5 text-sidebar-accent-foreground" />
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sair" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
