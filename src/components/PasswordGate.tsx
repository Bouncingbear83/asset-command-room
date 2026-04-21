import { useEffect, useState, type FormEvent, type ReactNode } from "react";

// SHA-256 of the access password. Hash is one-way; safe to commit.
const EXPECTED_HASH = "2ce309a61c25cab514f9514e73eb5a02cf6541b6d08f8bbda93b1614c2c2ef14";
const SESSION_KEY = "stellar-auth";

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

interface PasswordGateProps {
  children: ReactNode;
}

export default function PasswordGate({ children }: PasswordGateProps) {
  const [authed, setAuthed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_KEY) === "1";
  });
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  if (authed) return <>{children}</>;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !pw) return;
    setBusy(true);
    setError(false);
    const hash = await sha256(pw);
    if (hash.toLowerCase() === EXPECTED_HASH.toLowerCase()) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAuthed(true);
    } else {
      setError(true);
      setShake(true);
      setPw("");
      setTimeout(() => setShake(false), 500);
    }
    setBusy(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 24,
      }}
    >
      <style>{`
        @keyframes pgShake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .pg-shake { animation: pgShake 0.45s ease-in-out; }
        .pg-input::placeholder { color: #4a4a5a; }
      `}</style>
      <form
        onSubmit={handleSubmit}
        className={shake ? "pg-shake" : ""}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#0f0f22",
          border: "1px solid #1f1f33",
          borderRadius: 4,
          padding: "40px 32px",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 28,
            letterSpacing: "0.18em",
            color: "#c9a84c",
            marginBottom: 8,
          }}
        >
          STELLAR COMMAND
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "#8a8a9a",
            textTransform: "uppercase",
            marginBottom: 32,
          }}
        >
          Authorisation required
        </div>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            if (error) setError(false);
          }}
          placeholder="password"
          className="pg-input"
          style={{
            width: "100%",
            background: "#0a0a1a",
            border: `1px solid ${error ? "#a04040" : "#2a2a3e"}`,
            color: "#e6e6f0",
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            letterSpacing: "0.1em",
            padding: "12px 14px",
            borderRadius: 3,
            outline: "none",
            textAlign: "center",
          }}
        />
        <button
          type="submit"
          disabled={busy || !pw}
          style={{
            marginTop: 16,
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
            cursor: busy || !pw ? "not-allowed" : "pointer",
            opacity: busy || !pw ? 0.4 : 1,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!busy && pw) e.currentTarget.style.background = "rgba(201,168,76,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {busy ? "Verifying…" : "Enter"}
        </button>
        <div
          style={{
            marginTop: 16,
            minHeight: 14,
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.15em",
            color: "#a04040",
            textTransform: "uppercase",
          }}
        >
          {error ? "Access denied" : "\u00A0"}
        </div>
      </form>
    </div>
  );
}
