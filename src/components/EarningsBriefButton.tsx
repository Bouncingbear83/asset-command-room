import type { CSSProperties, MouseEvent } from "react";
import { useLatestEarningsNote } from "@/hooks/useVaultContent";

export const NO_BRIEF_TOOLTIP = "No brief yet (daily run writes one at T-10 bd)";

function go(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  window.history.pushState(null, "", `${window.location.pathname}?${q}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0 });
}

/** Opens the latest earnings brief from the vault; an OPEN engine verdict takes precedence (shown in DECIDE). */
export default function EarningsBriefButton({ ticker, style, label = "📋 Brief" }: { ticker: string; style?: CSSProperties; label?: string }) {
  const { note, verdictOpen, loading } = useLatestEarningsNote(ticker);
  const available = !!note || verdictOpen;
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (verdictOpen) go({ ticker });
    else if (note) go({ tab: "vault", note: note.path });
  };
  return (
    <button
      type="button"
      disabled={loading || !available}
      title={loading ? "Checking for brief…" : verdictOpen ? `Open engine verdict for ${ticker}` : note ? `Open ${note.path}` : NO_BRIEF_TOOLTIP}
      onClick={onClick}
      style={{ ...style, opacity: available ? 1 : 0.4, cursor: available ? "pointer" : "not-allowed" }}
    >
      {label}
    </button>
  );
}
