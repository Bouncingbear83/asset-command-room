import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { McpConnectorSection } from "@/components/McpConnectorSection";

// Validate `next` as a same-origin relative path.
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith("/") && !decoded.startsWith("//")) return decoded;
  } catch {}
  return "/";
}

const wrap: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#0a0a1a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 24,
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 400,
  background: "#0f0f22",
  border: "1px solid #1f1f33",
  borderRadius: 4,
  padding: "40px 32px",
  textAlign: "center",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
};

const title: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 28,
  letterSpacing: "0.18em",
  color: "#c9a84c",
  marginBottom: 8,
};

const sub: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: "0.2em",
  color: "#8a8a9a",
  textTransform: "uppercase",
  marginBottom: 28,
};

const input: React.CSSProperties = {
  width: "100%",
  background: "#0a0a1a",
  border: "1px solid #2a2a3e",
  color: "#e6e6f0",
  fontFamily: "'DM Mono', monospace",
  fontSize: 13,
  letterSpacing: "0.05em",
  padding: "11px 14px",
  borderRadius: 3,
  outline: "none",
  marginBottom: 10,
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "1px solid #c9a84c",
  color: "#c9a84c",
  fontFamily: "'DM Mono', monospace",
  fontSize: 11,
  letterSpacing: "0.25em",
  textTransform: "uppercase",
  padding: "12px",
  borderRadius: 3,
  cursor: "pointer",
  marginTop: 6,
};

const secondaryBtn: React.CSSProperties = {
  ...primaryBtn,
  borderColor: "#2a2a3e",
  color: "#e6e6f0",
  marginTop: 10,
};

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#8a8a9a",
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  cursor: "pointer",
  marginTop: 14,
  padding: 0,
};

const errStyle: React.CSSProperties = {
  minHeight: 16,
  marginTop: 12,
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: "0.12em",
  color: "#a04040",
  textTransform: "uppercase",
};

const infoStyle: React.CSSProperties = { ...errStyle, color: "#c9a84c" };

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");

  const nextPath = safeNext(new URLSearchParams(window.location.search).get("next"));

  useEffect(() => {
    // If a session already exists (e.g. arriving at /auth?next=... while logged in), bounce.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && nextPath !== "/") window.location.replace(nextPath);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session && nextPath !== "/") window.location.replace(nextPath);
    });
    return () => sub.subscription.unsubscribe();
  }, [nextPath]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !email || !password) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setBusy(false);
  };

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    const returnTo = window.location.origin + nextPath;
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: returnTo,
    });
    if (res.error) {
      setError(res.error.message || "Google sign-in failed");
      setBusy(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !email) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setInfo("Check your email for the reset link");
    setBusy(false);
  };

  return (
    <div style={wrap}>
      <form onSubmit={mode === "signin" ? handleSignIn : handleForgot} style={card}>
        <div style={title}>STELLAR COMMAND</div>
        <div style={sub}>{mode === "signin" ? "Sign in" : "Reset password"}</div>

        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          style={input}
          required
        />
        {mode === "signin" && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            style={input}
            required
          />
        )}

        <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.4 : 1 }}>
          {busy ? "…" : mode === "signin" ? "Enter" : "Send reset link"}
        </button>

        {mode === "signin" && (
          <button type="button" onClick={handleGoogle} disabled={busy} style={{ ...secondaryBtn, opacity: busy ? 0.4 : 1 }}>
            Continue with Google
          </button>
        )}

        <div style={info ? infoStyle : errStyle}>{error || info || "\u00A0"}</div>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "forgot" : "signin");
            setError(null);
            setInfo(null);
          }}
          style={linkBtn}
        >
          {mode === "signin" ? "Forgot password?" : "Back to sign in"}
        </button>
      </form>
      <div style={{ width: "100%", maxWidth: 400, marginTop: 16 }}>
        <McpConnectorSection />
      </div>
    </div>
  );
}
