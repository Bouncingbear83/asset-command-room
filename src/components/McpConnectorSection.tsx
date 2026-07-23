import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OAuthClient {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  created_at: string | null;
}

const MCP_URL = "https://eervjywaxpxqdjjhtguz.supabase.co/functions/v1/mcp";
const KNOWN_REDIRECTS: { label: string; uri: string }[] = [
  { label: "Claude", uri: "https://claude.ai/api/mcp/auth_callback" },
  { label: "ChatGPT", uri: "https://chatgpt.com/connector_platform_oauth_redirect" },
];

const box: React.CSSProperties = {
  marginTop: 24,
  padding: 16,
  background: "#0a0a1a",
  border: "1px solid #1f1f33",
  borderRadius: 3,
  textAlign: "left",
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  color: "#8a8a9a",
  letterSpacing: "0.08em",
};
const rowStyle: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", marginBottom: 6 };
const codeStyle: React.CSSProperties = {
  flex: 1,
  background: "#050510",
  padding: "6px 8px",
  border: "1px solid #1f1f33",
  color: "#e6e6f0",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontSize: 10,
};
const copyBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #2a2a3e",
  color: "#c9a84c",
  padding: "6px 10px",
  fontSize: 9,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "inherit",
};
const label: React.CSSProperties = {
  color: "#c9a84c",
  textTransform: "uppercase",
  letterSpacing: "0.2em",
  marginBottom: 4,
};

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

export function McpConnectorSection() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [clients, setClients] = useState<OAuthClient[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadClients() {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("list-oauth-clients", {
        method: "GET",
      });
      if (error) throw new Error(error.message);
      const list = Array.isArray(data?.clients) ? (data.clients as OAuthClient[]) : [];
      setClients(list);
    } catch (e: any) {
      setErr(e.message ?? "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(text: string, key: string) {
    copy(text);
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
  }

  return (
    <div style={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...label,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 10,
        }}
      >
        {open ? "▾" : "▸"} Connect an AI assistant (MCP)
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={label}>MCP endpoint</div>
          <div style={rowStyle}>
            <div style={codeStyle} title={MCP_URL}>{MCP_URL}</div>
            <button
              type="button"
              style={copyBtn}
              onClick={() => handleCopy(MCP_URL, "url")}
            >
              {copied === "url" ? "Copied" : "Copy"}
            </button>
          </div>

          <div style={{ ...label, marginTop: 12 }}>Redirect URIs</div>
          {KNOWN_REDIRECTS.map((r) => (
            <div key={r.uri} style={rowStyle}>
              <div style={{ width: 60, color: "#c9a84c" }}>{r.label}</div>
              <div style={codeStyle} title={r.uri}>{r.uri}</div>
              <button
                type="button"
                style={copyBtn}
                onClick={() => handleCopy(r.uri, r.uri)}
              >
                {copied === r.uri ? "Copied" : "Copy"}
              </button>
            </div>
          ))}

          <div style={{ ...label, marginTop: 12 }}>Recent OAuth Client IDs (DCR)</div>
          <div style={{ marginBottom: 8, fontSize: 10 }}>
            {signedIn
              ? "Paste one of these into Claude/ChatGPT's ‘OAuth Client ID’ field if a fresh connector attempt fails."
              : "Sign in above to view client IDs your connector has registered."}
          </div>
          {signedIn && (
            <>
              <button
                type="button"
                style={{ ...copyBtn, marginBottom: 8 }}
                onClick={loadClients}
                disabled={loading}
              >
                {loading ? "Loading…" : clients ? "Refresh" : "Load client IDs"}
              </button>
              {err && <div style={{ color: "#a04040", marginBottom: 6 }}>{err}</div>}
              {clients && clients.length === 0 && (
                <div>No registered clients yet — connect once from Claude/ChatGPT first.</div>
              )}
              {clients &&
                clients.map((c) => (
                  <div key={c.client_id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: "#8a8a9a", marginBottom: 2 }}>
                      {c.client_name ?? "unnamed"}
                      {c.created_at ? ` · ${new Date(c.created_at).toLocaleDateString()}` : ""}
                    </div>
                    <div style={rowStyle}>
                      <div style={codeStyle} title={c.client_id}>{c.client_id}</div>
                      <button
                        type="button"
                        style={copyBtn}
                        onClick={() => handleCopy(c.client_id, c.client_id)}
                      >
                        {copied === c.client_id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
