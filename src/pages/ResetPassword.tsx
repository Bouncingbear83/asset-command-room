import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash automatically and fires PASSWORD_RECOVERY
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirm) return setError("Passwords do not match");
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    setInfo("Password updated. Redirecting…");
    setTimeout(() => navigate("/", { replace: true }), 1200);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0a1a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 400, background: "#0f0f22", border: "1px solid #1f1f33", borderRadius: 4, padding: "40px 32px", textAlign: "center" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, letterSpacing: "0.18em", color: "#c9a84c", marginBottom: 8 }}>STELLAR COMMAND</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: "#8a8a9a", textTransform: "uppercase", marginBottom: 28 }}>Set new password</div>
        {!ready ? (
          <div style={{ color: "#8a8a9a", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Waiting for recovery link…</div>
        ) : (
          <>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="new password" style={{ width: "100%", background: "#0a0a1a", border: "1px solid #2a2a3e", color: "#e6e6f0", fontFamily: "'DM Mono', monospace", fontSize: 13, padding: "11px 14px", borderRadius: 3, outline: "none", marginBottom: 10, boxSizing: "border-box" }} required />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="confirm password" style={{ width: "100%", background: "#0a0a1a", border: "1px solid #2a2a3e", color: "#e6e6f0", fontFamily: "'DM Mono', monospace", fontSize: 13, padding: "11px 14px", borderRadius: 3, outline: "none", marginBottom: 10, boxSizing: "border-box" }} required />
            <button type="submit" disabled={busy} style={{ width: "100%", background: "transparent", border: "1px solid #c9a84c", color: "#c9a84c", fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", padding: 12, borderRadius: 3, cursor: "pointer", marginTop: 6, opacity: busy ? 0.4 : 1 }}>Update password</button>
          </>
        )}
        <div style={{ minHeight: 16, marginTop: 12, fontFamily: "'DM Mono', monospace", fontSize: 10, color: info ? "#c9a84c" : "#a04040", textTransform: "uppercase" }}>{error || info || "\u00A0"}</div>
      </form>
    </div>
  );
}
