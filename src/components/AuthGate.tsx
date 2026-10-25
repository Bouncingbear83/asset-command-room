import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import Auth from "@/pages/Auth";
import { isOwnerEmail } from "@/lib/ownerAccess";

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const acceptSession = (s: Session | null) => {
      if (s && !isOwnerEmail(s.user.email)) {
        setSession(null);
        setDenied(true);
        void supabase.auth.signOut();
        return;
      }
      setSession(s);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      acceptSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      acceptSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0a0a1a" }} />
    );
  }

  if (!session) return <Auth accessDenied={denied} />;
  return <>{children}</>;
}
