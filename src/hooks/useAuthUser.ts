import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;

    void supabase.auth.getSession()
      .then(({ data }) => {
        if (active && !authEventReceived) {
          setUser(data.session?.user ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active && !authEventReceived) {
          setUser(null);
          setLoading(false);
        }
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      authEventReceived = true;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
