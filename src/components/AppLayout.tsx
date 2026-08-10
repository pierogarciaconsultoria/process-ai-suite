import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { loginRedirectFor } from "@/lib/auth-navigation";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export function AppLayout() {
  const location = useLocation();
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "anonymous">("loading");

  useEffect(() => {
    let active = true;
    let authEventReceived = false;

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (active && !authEventReceived) setAuthState(!error && data.session ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (active && !authEventReceived) setAuthState("anonymous");
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        authEventReceived = true;
        setAuthState(session ? "authenticated" : "anonymous");
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Verificando sessão...
      </div>
    );
  }

  if (authState === "anonymous") {
    return <Navigate to={loginRedirectFor(location)} replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b bg-card px-4">
            <SidebarTrigger className="mr-4" />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
