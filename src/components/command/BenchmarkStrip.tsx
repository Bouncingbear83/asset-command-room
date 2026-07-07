diff --git a/src/components/CommandTab.tsx b/src/components/CommandTab.tsx
index 58df95c..1b319db 100644
--- a/src/components/CommandTab.tsx
+++ b/src/components/CommandTab.tsx
@@ -8,10 +8,11 @@ import CapitalQueue from "@/components/command/CapitalQueue";
 import OpportunityRank from "@/components/OpportunityRank";
 import OpportunityScatter from "@/components/command/OpportunityScatter";
 import OpportunityQuadrants from "@/components/command/OpportunityQuadrants";
 import NarrativeWatchCard from "@/components/NarrativeWatchCard";
 import GmExposureChip from "@/components/command/GmExposureChip";
+import BenchmarkStrip from "@/components/command/BenchmarkStrip";
 import LayerReviewCalendar from "@/components/LayerReviewCalendar";
 import ToolsCard from "@/components/command/ToolsCard";
 import ScheduledReviewsCard from "@/components/ScheduledReviewsCard";
 
 const SIGNAL_KEYS = ["VIX", "SP500_YTD_PCT", "GOLD_USD", "PAUSE_ACTIVE", "EARNINGS_BLACKOUT"] as const;
@@ -182,18 +183,21 @@ export default function CommandTab() {
         macroState={macroState}
         cashGbp={cashGbp}
         isMobile={isMobile}
       />
 
-      {/* ── G(m) MICRO-CAP EXPOSURE ── */}
-      <div style={{ padding: "0 var(--app-px, 40px)" }}>
-        <GmExposureChip scores={scores} holdings={holdings} watchlist={watchlist} />
-      </div>
+      {/* ── BENCHMARK CONTEXT ── */}
+      <BenchmarkStrip />
 
       {/* ── CARD 1: MOVERS ── */}
       <MoversCard holdings={holdings} watchlist={activeWatchlist} earnings={earningsCalendar} />
 
+      {/* ── G(m) MICRO-CAP EXPOSURE ── */}
+      <div style={{ padding: "0 var(--app-px, 40px)", marginBottom: 4 }}>
+        <GmExposureChip scores={scores} holdings={holdings} watchlist={watchlist} />
+      </div>
+
       {/* ── CARD 2: ACTION INBOX ── */}
       <ActionInbox holdings={holdings} watchlist={watchlist} earnings={earningsCalendar} />
 
       {/* ── CARD 3: CAPITAL QUEUE ── */}
       <CapitalQueue holdings={holdings} watchlist={watchlist} layers={layers} macroState={macroState} />
diff --git a/src/components/command/BenchmarkStrip.tsx b/src/components/command/BenchmarkStrip.tsx
new file mode 100644
index 0000000..a4fe004
--- /dev/null
+++ b/src/components/command/BenchmarkStrip.tsx
@@ -0,0 +1,179 @@
+/**
+ * BenchmarkStrip — compact market context bar showing daily % moves
+ * for three reference indices: NASDAQ, FTSE 100, Nikkei 225.
+ *
+ * Sits between CommandHeader and MoversCard so the operator can see
+ * at a glance whether portfolio movers are beta or alpha.
+ *
+ * Data: calls the same `live-prices` edge function used by useLivePrices,
+ * but with its own fetch/cache cycle to avoid polluting the portfolio cache.
+ */
+
+import { useState, useEffect, useRef } from "react";
+import { supabase } from "@/integrations/supabase/client";
+import { useIsMobile } from "@/hooks/use-mobile";
+
+interface BenchmarkData {
+  price: number;
+  changePercent: number | null;
+  marketState: string;
+}
+
+type BenchmarkMap = Record<string, BenchmarkData>;
+
+const BENCHMARKS = [
+  { yahoo: "^IXIC", label: "NDX", fullLabel: "NASDAQ" },
+  { yahoo: "^FTSE", label: "FTSE", fullLabel: "FTSE 100" },
+  { yahoo: "^N225", label: "NKY", fullLabel: "Nikkei 225" },
+] as const;
+
+const CACHE_TTL_MS = 5 * 60 * 1000;
+let benchmarkCache: { ts: number; data: BenchmarkMap } | null = null;
+
+export default function BenchmarkStrip() {
+  const [data, setData] = useState<BenchmarkMap>({});
+  const [loading, setLoading] = useState(true);
+  const isMobile = useIsMobile();
+  const fetched = useRef(false);
+
+  useEffect(() => {
+    if (benchmarkCache && Date.now() - benchmarkCache.ts < CACHE_TTL_MS) {
+      setData(benchmarkCache.data);
+      setLoading(false);
+      return;
+    }
+
+    if (fetched.current) return;
+    fetched.current = true;
+
+    (async () => {
+      try {
+        const tickers = BENCHMARKS.map((b) => b.yahoo);
+        const { data: result, error } = await supabase.functions.invoke(
+          "live-prices",
+          { body: { tickers } },
+        );
+
+        if (error) {
+          console.error("[BenchmarkStrip] edge function error:", error);
+          setLoading(false);
+          return;
+        }
+
+        const prices = result?.prices ?? {};
+        const mapped: BenchmarkMap = {};
+        for (const b of BENCHMARKS) {
+          const raw = prices[b.yahoo] ?? prices[b.yahoo.toUpperCase()] ?? null;
+          if (raw) {
+            mapped[b.yahoo] = {
+              price: raw.price,
+              changePercent: raw.changePercent ?? null,
+              marketState: raw.marketState ?? "",
+            };
+          }
+        }
+
+        benchmarkCache = { ts: Date.now(), data: mapped };
+        setData(mapped);
+      } catch (err) {
+        console.error("[BenchmarkStrip] fetch failed:", err);
+      } finally {
+        setLoading(false);
+      }
+    })();
+  }, []);
+
+  const hasData = BENCHMARKS.some((b) => data[b.yahoo]);
+
+  if (loading || !hasData) return null;
+
+  return (
+    <div
+      style={{
+        display: "flex",
+        alignItems: "center",
+        gap: isMobile ? 8 : 14,
+        padding: isMobile ? "6px 12px" : "6px 16px",
+        marginBottom: 0,
+      }}
+    >
+      <span
+        style={{
+          fontFamily: "var(--font-mono)",
+          fontSize: 9,
+          letterSpacing: "0.12em",
+          color: "var(--text-dim)",
+          textTransform: "uppercase",
+          flexShrink: 0,
+        }}
+      >
+        MKT
+      </span>
+      {BENCHMARKS.map((b) => {
+        const d = data[b.yahoo];
+        if (!d) return null;
+        const pct = d.changePercent;
+        const color =
+          pct == null
+            ? "var(--text-dim)"
+            : pct > 0
+              ? "var(--green)"
+              : pct < 0
+                ? "var(--red)"
+                : "var(--text-dim)";
+        const sign = pct != null && pct > 0 ? "+" : "";
+        const closed = d.marketState === "CLOSED" || d.marketState === "POST";
+
+        return (
+          <div
+            key={b.yahoo}
+            style={{
+              display: "inline-flex",
+              alignItems: "center",
+              gap: 5,
+              padding: "3px 8px",
+              border: "1px solid var(--rim)",
+              borderRadius: 2,
+              background: "transparent",
+            }}
+            title={`${b.fullLabel}${closed ? " (closed)" : ""}`}
+          >
+            <span
+              style={{
+                fontFamily: "var(--font-mono)",
+                fontSize: 9,
+                letterSpacing: "0.08em",
+                color: "var(--text-dim)",
+              }}
+            >
+              {b.label}
+            </span>
+            <span
+              style={{
+                fontFamily: "var(--font-mono)",
+                fontSize: 10,
+                fontWeight: 600,
+                color,
+                letterSpacing: "0.04em",
+              }}
+            >
+              {pct != null ? `${sign}${pct.toFixed(2)}%` : "—"}
+            </span>
+            {closed && (
+              <span
+                style={{
+                  fontFamily: "var(--font-mono)",
+                  fontSize: 7,
+                  color: "var(--text-dim)",
+                  opacity: 0.6,
+                }}
+              >
+                ●
+              </span>
+            )}
+          </div>
+        );
+      })}
+    </div>
+  );
+}
