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

interface CreatedClient {
  client_id: string;
  client_secret: string | null;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
}

export function McpConnectorSection() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [clients, setClients] = useState<OAuthClient[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Manual client registration form state
  const [name, setName] = useState("Claude AI");
  const [redirect, setRedirect] = useState(KNOWN_REDIRECTS[0].uri);
  const [customRedirect, setCustomRedirect] = useState("");
  const [authMethod, setAuthMethod] = useState<"client_secret_basic" | "none">("client_secret_basic");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedClient | null>(null);

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

  async function createClientNow() {
    setCreating(true);
    setCreateErr(null);
    setCreated(null);
    try {
      const uri = redirect === "__custom__" ? customRedirect.trim() : redirect;
      if (!uri) throw new Error("Redirect URI is required");
      const { data, error } = await supabase.functions.invoke("register-mcp-client", {
        body: {
          client_name: name.trim() || "MCP Client",
          redirect_uris: [uri],
          token_endpoint_auth_method: authMethod,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.client_id) throw new Error(data?.error ?? "Registration failed");
      setCreated(data as CreatedClient);
    } catch (e: any) {
      setCreateErr(e.message ?? "Failed to register client");
    } finally {
      setCreating(false);
    }
  }

  function handleCopy(text: string, key: string) {
    copy(text);
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
  }

  const inputStyle: React.CSSProperties = {
    background: "#050510",
    border: "1px solid #1f1f33",
    color: "#e6e6f0",
    padding: "6px 8px",
    fontSize: 10,
    fontFamily: "inherit",
    width: "100%",
  };

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
            <button type="button" style={copyBtn} onClick={() => handleCopy(MCP_URL, "url")}>
              {copied === "url" ? "Copied" : "Copy"}
            </button>
          </div>

          <div style={{ ...label, marginTop: 12 }}>Redirect URIs</div>
          {KNOWN_REDIRECTS.map((r) => (
            <div key={r.uri} style={rowStyle}>
              <div style={{ width: 60, color: "#c9a84c" }}>{r.label}</div>
              <div style={codeStyle} title={r.uri}>{r.uri}</div>
              <button type="button" style={copyBtn} onClick={() => handleCopy(r.uri, r.uri)}>
                {copied === r.uri ? "Copied" : "Copy"}
              </button>
            </div>
          ))}

          {/* Manual pre-registration */}
          <div style={{ ...label, marginTop: 16 }}>Register a client manually</div>
          <div style={{ marginBottom: 8, fontSize: 10 }}>
            {signedIn
              ? "If Claude/ChatGPT fails auto-registration (DCR), pre-register a client here and paste the Client ID + Secret into the connector's Advanced Settings."
              : "Sign in above to register a manual OAuth client."}
          </div>

          {signedIn && !created && (
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, color: "#8a8a9a", marginBottom: 2 }}>Client name</div>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Claude AI"
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#8a8a9a", marginBottom: 2 }}>Redirect URI</div>
                <select
                  style={inputStyle}
                  value={redirect}
                  onChange={(e) => setRedirect(e.target.value)}
                >
                  {KNOWN_REDIRECTS.map((r) => (
                    <option key={r.uri} value={r.uri}>{r.label} — {r.uri}</option>
                  ))}
                  <option value="__custom__">Custom…</option>
                </select>
                {redirect === "__custom__" && (
                  <input
                    style={{ ...inputStyle, marginTop: 4 }}
                    value={customRedirect}
                    onChange={(e) => setCustomRedirect(e.target.value)}
                    placeholder="https://…/callback"
                  />
                )}
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#8a8a9a", marginBottom: 2 }}>Auth method</div>
                <select
                  style={inputStyle}
                  value={authMethod}
                  onChange={(e) => setAuthMethod(e.target.value as any)}
                >
                  <option value="client_secret_basic">Confidential (client_secret_basic) — Claude</option>
                  <option value="none">Public (PKCE, no secret)</option>
                </select>
              </div>
              <button
                type="button"
                style={{ ...copyBtn, marginTop: 4 }}
                onClick={createClientNow}
                disabled={creating}
              >
                {creating ? "Registering…" : "Create client"}
              </button>
              {createErr && <div style={{ color: "#a04040" }}>{createErr}</div>}
            </div>
          )}

          {signedIn && created && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: "#c9a84c", fontSize: 10, marginBottom: 6 }}>
                ✓ Client created — copy the secret now, it won't be shown again.
              </div>
              <div style={{ fontSize: 9, color: "#8a8a9a", marginBottom: 2 }}>Client ID</div>
              <div style={rowStyle}>
                <div style={codeStyle} title={created.client_id}>{created.client_id}</div>
                <button
                  type="button"
                  style={copyBtn}
                  onClick={() => handleCopy(created.client_id, "cid")}
                >
                  {copied === "cid" ? "Copied" : "Copy"}
                </button>
              </div>
              {created.client_secret && (
                <>
                  <div style={{ fontSize: 9, color: "#8a8a9a", marginBottom: 2, marginTop: 6 }}>
                    Client Secret
                  </div>
                  <div style={rowStyle}>
                    <div style={codeStyle} title={created.client_secret}>{created.client_secret}</div>
                    <button
                      type="button"
                      style={copyBtn}
                      onClick={() => handleCopy(created.client_secret!, "cs")}
                    >
                      {copied === "cs" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </>
              )}
              <div style={{ marginTop: 10, fontSize: 10, lineHeight: 1.6 }}>
                <div style={{ color: "#c9a84c", marginBottom: 4 }}>Next steps</div>
                <div>1. Copy Client ID{created.client_secret ? " and Secret" : ""} above.</div>
                <div>2. In Claude: Settings → Connectors → Add → paste the MCP endpoint → open Advanced Settings → paste Client ID{created.client_secret ? " + Secret" : ""}.</div>
                <div>3. Complete sign-in and approve on the consent screen.</div>
              </div>
              <button
                type="button"
                style={{ ...copyBtn, marginTop: 10 }}
                onClick={() => setCreated(null)}
              >
                Register another
              </button>
            </div>
          )}

          <div style={{ ...label, marginTop: 12 }}>Recent OAuth Client IDs (all)</div>
          <div style={{ marginBottom: 8, fontSize: 10 }}>
            {signedIn
              ? "Shows both DCR-registered and manually pre-registered clients. Secrets are never listed."
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
                <div>No registered clients yet.</div>
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
