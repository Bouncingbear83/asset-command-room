import { useMemo, useState, useCallback, useRef } from "react";
import { LiveHolding, LiveWatchItem, LiveScore } from "@/hooks/usePortfolioData";
import { useIrrBb } from "@/hooks/useIrrBb";
import { useQuartetMap } from "@/hooks/useQuartetMap";
import { useScoresSnapshot } from "@/hooks/useScoresSnapshot";
import { computeLiveAsymmetry } from "@/lib/liveAsymmetry";
import { PROFILE_PALETTE } from "@/components/intelligence/profileChips";
import { normaliseTicker } from "@/lib/tickerAlias";
import { useFactSheet } from "@/components/factsheet/FactSheetProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { IS_NUMERIC_TICKER } from "@/hooks/useIrrBb";

// ── Types ──
interface Entry {
  ticker: string;
  name: string;
  label: string;
  layer: string;
  profileKey: string;
  profileLabel: string;
  irrBb: number;
  asymmetry: number;
  held: boolean;
  score: number | null;
  profileColor: string;
}

type Quadrant = "deploy" | "actionable" | "watch" | "dormant";

interface QuadrantDef {
  key: Quadrant;
  title: string;
  subtitle: string;
  accent: string;
  accentBg: string;
  test: (e: Entry) => boolean;
}

const QUADRANTS: QuadrantDef[] = [
  {
    key: "deploy",
    title: "Deploy",
    subtitle: "IRR-BB \u226520% + Asym \u22652:1",
    accent: "#5abfa0",
    accentBg: "rgba(90,191,160,0.08)",
    test: (e) => e.irrBb >= 20 && e.asymmetry >= 2,
  },
  {
    key: "actionable",
    title: "Actionable",
    subtitle: "IRR-BB 15\u201320% or Asym \u22652:1",
    accent: "#d4a06a",
    accentBg: "rgba(200,146,90,0.08)",
    test: (e) => (e.irrBb >= 15 && e.irrBb < 20) || (e.irrBb >= 15 && e.asymmetry >= 2),
  },
  {
    key: "watch",
    title: "Watch",
    subtitle: "IRR-BB <15% + Asym \u22651.5:1",
    accent: "#7da4d8",
    accentBg: "rgba(110,142,200,0.08)",
    test: (e) => e.irrBb < 15 && e.asymmetry >= 1.5,
  },
  {
    key: "dormant",
    title: "Dormant",
    subtitle: "IRR-BB <15% + Asym <1.5:1",
    accent: "#6b6b7b",
    accentBg: "rgba(107,107,123,0.06)",
    test: (e) => e.irrBb < 15 && e.asymmetry < 1.5,
  },
];

// Classify into first matching quadrant (deploy > actionable > watch > dormant)
function classify(e: Entry): Quadrant {
  for (const q of QUADRANTS) {
    if (q.test(e)) return q.key;
  }
  return "dormant";
}

// ── Profile colour resolver ──
function profileColor(profileKey: string): string {
  switch (profileKey) {
    case "STELLAR_COMPOUNDER":
    case "GENERIC_COMPOUNDER":
      return PROFILE_PALETTE.COMPOUNDER.fg;
    case "RECLASSIFICATION":
      return PROFILE_PALETTE.RECLASSIFICATION.fg;
    case "CYCLE":
      return PROFILE_PALETTE.CYCLE.fg;
    case "PRE_PRODUCTION":
      return PROFILE_PALETTE.PRE_PRODUCTION.fg;
    case "HEDGE":
      return PROFILE_PALETTE.HEDGE.fg;
    case "VEHICLE":
      return PROFILE_PALETTE.VEHICLE.fg;
    default:
      return "#8A8A9A";
  }
}

// ── Props ──
interface Props {
  scores: LiveScore[];
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
}

export default function OpportunityQuadrants({ scores, holdings, watchlist }: Props) {
  const isMobile = useIsMobile();
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { byTicker: irrMap } = useIrrBb(scores, holdings, watchlist);
  const { byTicker: snapshotMap } = useScoresSnapshot();
  const quartetMap = useQuartetMap(scores ?? [], holdings ?? [], watchlist ?? [], snapshotMap);
  const { open: openFactSheet } = useFactSheet();

  // Build profile lookup
  const profileMap = useMemo(() => {
    const m = new Map<string, { returnProfile: string; compounderSubtype: string }>();
    for (const s of scores) {
      const t = normaliseTicker(s.ticker);
      if (!t) continue;
      m.set(t, {
        returnProfile: (s as any).returnProfile ?? "",
        compounderSubtype: (s as any).compounderSubtype ?? "",
      });
    }
    return m;
  }, [scores]);

  // Build entries
  const entries = useMemo(() => {
    const out: Entry[] = [];
    for (const [t, entry] of irrMap) {
      if (entry.result.irrBb === null) continue;

      const qEntry = quartetMap.get(t);
      const asym = qEntry?.asymmetry ?? computeLiveAsymmetry(
        { bullBase: null, bullStretch: null, bearThesisWeak: null, bearSubstrateFail: null, bullBearAtDate: null },
        null,
      );
      if (asym.baseRatio === null || asym.baseRatio <= 0) continue;

      const irrPct = Math.min(entry.result.irrBb * 100, 50);
      const asymClamped = Math.min(asym.baseRatio, 10);

      const isNumeric = IS_NUMERIC_TICKER.test(entry.ticker);
      const label = isNumeric && entry.name ? entry.name : entry.ticker;

      const prof = profileMap.get(t);
      let profileKey = "UNKNOWN";
      let profileLabel = "Unknown";
      if (prof?.returnProfile === "COMPOUNDER") {
        profileKey = prof.compounderSubtype === "GENERIC_COMPOUNDER"
          ? "GENERIC_COMPOUNDER" : "STELLAR_COMPOUNDER";
        profileLabel = profileKey === "STELLAR_COMPOUNDER" ? "Stellar" : "Generic";
      } else if (prof?.returnProfile === "RECLASSIFICATION") {
        profileKey = "RECLASSIFICATION";
        profileLabel = "Reclass";
      } else if (prof?.returnProfile === "CYCLE") {
        profileKey = "CYCLE";
        profileLabel = "Cycle";
      } else if (prof?.returnProfile === "PRE_PRODUCTION") {
        profileKey = "PRE_PRODUCTION";
        profileLabel = "Pre-Prod";
      } else if (prof?.returnProfile === "HEDGE") {
        profileKey = "HEDGE";
        profileLabel = "Hedge";
      } else if (prof?.returnProfile === "VEHICLE") {
        profileKey = "VEHICLE";
        profileLabel = "Vehicle";
      }

      out.push({
        ticker: entry.ticker,
        name: entry.name,
        label,
        layer: entry.layer || "Hedge",
        profileKey,
        profileLabel,
        irrBb: Math.round(irrPct * 10) / 10,
        asymmetry: Math.round(asymClamped * 10) / 10,
        held: entry.held,
        score: entry.score,
        profileColor: profileColor(profileKey),
      });
    }
    // Sort by IRR-BB descending within each quadrant
    out.sort((a, b) => b.irrBb - a.irrBb);
    return out;
  }, [irrMap, quartetMap, profileMap]);

  // Bucket into quadrants
  const buckets = useMemo(() => {
    const m: Record<Quadrant, Entry[]> = { deploy: [], actionable: [], watch: [], dormant: [] };
    for (const e of entries) {
      m[classify(e)].push(e);
    }
    return m;
  }, [entries]);

  // Scroll handling for swipe indicator
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / QUADRANTS.length;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveIdx(Math.min(idx, QUADRANTS.length - 1));
  }, []);

  const scrollTo = useCallback((idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / QUADRANTS.length;
    el.scrollTo({ left: cardWidth * idx, behavior: "smooth" });
    setActiveIdx(idx);
  }, []);

  if (!isMobile) return null;
  if (entries.length < 2) return null;

  return (
    <div style={{
      background: "var(--panel)",
      border: "1px solid var(--rim)",
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 14px 8px",
        borderBottom: "1px solid var(--rim)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
          letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-mid)",
        }}>
          Opportunity map
        </span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 8,
          color: "var(--text-dim)", letterSpacing: "0.06em",
        }}>
          {entries.length} names
        </span>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 0, padding: "0 2px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        {QUADRANTS.map((q, i) => {
          const count = buckets[q.key].length;
          const isActive = activeIdx === i;
          return (
            <button
              key={q.key}
              onClick={() => scrollTo(i)}
              style={{
                flex: 1,
                padding: "8px 4px 6px",
                fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.06em",
                textTransform: "uppercase",
                background: "transparent",
                border: "none",
                borderBottom: isActive ? `2px solid ${q.accent}` : "2px solid transparent",
                color: isActive ? q.accent : "var(--text-dim)",
                cursor: "pointer",
                transition: "color 0.15s",
              }}
            >
              {q.title}
              {count > 0 && (
                <span style={{
                  marginLeft: 4, fontSize: 8,
                  color: isActive ? q.accent : "var(--text-dim)",
                  opacity: isActive ? 0.8 : 0.5,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Swipeable card container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          display: "flex",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {QUADRANTS.map((q) => {
          const items = buckets[q.key];
          return (
            <div
              key={q.key}
              style={{
                minWidth: "100%",
                scrollSnapAlign: "start",
                padding: "8px 12px 12px",
              }}
            >
              {/* Quadrant subtitle */}
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 8,
                color: q.accent, opacity: 0.6,
                letterSpacing: "0.06em", marginBottom: 8,
              }}>
                {q.subtitle}
              </div>

              {items.length === 0 ? (
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 10,
                  color: "var(--text-dim)", padding: "20px 0",
                  textAlign: "center", opacity: 0.5,
                }}>
                  No names in this zone
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {items.map((e) => (
                    <div
                      key={e.ticker}
                      onClick={() => openFactSheet(e.ticker)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 8px",
                        background: q.accentBg,
                        borderRadius: 3,
                        cursor: "pointer",
                        borderLeft: `2px solid ${q.accent}33`,
                      }}
                    >
                      {/* Ticker / Name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                          color: "var(--text)", whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {e.label}
                        </div>
                        {e.name && e.label !== e.name && (
                          <div style={{
                            fontFamily: "var(--font-mono)", fontSize: 8,
                            color: "var(--text-dim)", marginTop: 1,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {e.name}
                          </div>
                        )}
                      </div>

                      {/* Profile chip */}
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: 7,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        padding: "1px 4px", borderRadius: 2,
                        color: e.profileColor,
                        border: `1px solid ${e.profileColor}55`,
                        whiteSpace: "nowrap",
                      }}>
                        {e.profileLabel}
                      </span>

                      {/* Held/WL badge */}
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: 7,
                        letterSpacing: "0.1em", textTransform: "uppercase",
                        padding: "1px 4px", borderRadius: 2,
                        color: e.held ? "var(--gold)" : "var(--text-dim)",
                        border: `1px solid ${e.held ? "rgba(200,169,110,0.3)" : "var(--rim)"}`,
                        background: e.held ? "rgba(200,169,110,0.06)" : "transparent",
                      }}>
                        {e.held ? "HELD" : "WL"}
                      </span>

                      {/* Metrics */}
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-end",
                        gap: 1, minWidth: 52,
                      }}>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
                          color: e.irrBb >= 20 ? "var(--green, #5abfa0)" : e.irrBb >= 15 ? "#d4a06a" : "var(--text-dim)",
                        }}>
                          {e.irrBb.toFixed(1)}%
                        </span>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 8,
                          color: "var(--text-dim)",
                        }}>
                          {e.asymmetry.toFixed(1)}:1
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Swipe dots */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 6,
        padding: "4px 0 10px",
      }}>
        {QUADRANTS.map((q, i) => (
          <div
            key={q.key}
            onClick={() => scrollTo(i)}
            style={{
              width: activeIdx === i ? 14 : 5,
              height: 5,
              borderRadius: 3,
              background: activeIdx === i ? q.accent : "rgba(255,255,255,0.15)",
              transition: "all 0.2s",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
}
