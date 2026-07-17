import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Typed shim: supabase.auth.oauth is beta and not fully typed in this SDK version.
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const authOauth = (supabase.auth as unknown as { oauth: OAuthNs }).oauth;

const wrap: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#0a0a1a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  color: "#e6e6f0",
  fontFamily: "'DM Mono', monospace",
};
const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: "#0f0f22",
  border: "1px solid #1f1f33",
  borderRadius: 4,
  padding: "36px 32px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
};
const title: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 24,
  letterSpacing: "0.14em",
  color: "#c9a84c",
  marginBottom: 8,
};
const sub: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.2em",
  color: "#8a8a9a",
  textTransform: "uppercase",
  marginBottom: 24,
};
const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "10px 0",
  borderTop: "1px solid #1f1f33",
  fontSize: 12,
};
const btn: React.CSSProperties = {
  flex: 1,
  padding: "12px",
  fontFamily: "'DM Mono', monospace",
  fontSize: 11,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  borderRadius: 3,
  cursor: "pointer",
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      setUserEmail(sess.session.user.email ?? null);
      const { data, error } = await authOauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await authOauth.approveAuthorization(authorizationId)
      : await authOauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={title}>Authorization error</div>
          <div style={{ ...sub, color: "#a04040" }}>{error}</div>
        </div>
      </div>
    );
  }
  if (!details) {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={title}>Loading…</div>
        </div>
      </div>
    );
  }

  const clientName = details.client?.name ?? "an app";
  const scopes: string[] = details.scopes ?? details.requested_scopes ?? [];

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={title}>Connect {clientName}</div>
        <div style={sub}>to Stellar Command</div>

        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#c8c8d4", marginBottom: 20 }}>
          {clientName} will be able to call this app's enabled tools while you are signed in.
          It cannot bypass this app's permissions or backend policies.
        </p>

        {userEmail && (
          <div style={row}>
            <span style={{ color: "#8a8a9a" }}>Signed in as</span>
            <span>{userEmail}</span>
          </div>
        )}
        <div style={row}>
          <span style={{ color: "#8a8a9a" }}>Client</span>
          <span>{clientName}</span>
        </div>
        {scopes.length > 0 && (
          <div style={row}>
            <span style={{ color: "#8a8a9a" }}>Scopes</span>
            <span>{scopes.join(", ")}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            style={{
              ...btn,
              background: "transparent",
              border: "1px solid #2a2a3e",
              color: "#e6e6f0",
              opacity: busy ? 0.4 : 1,
            }}
          >
            Deny
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            style={{
              ...btn,
              background: "transparent",
              border: "1px solid #c9a84c",
              color: "#c9a84c",
              opacity: busy ? 0.4 : 1,
            }}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
