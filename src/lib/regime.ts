/**
 * Sprint A · A1 — drawdown regime (OB v3.20.2 §3.4.9a; Weekly v1.5 C10 RAG). Pure, display only.
 * Live-quote values are intraday and indicative; the doctrine tests at the close (session is canonical).
 */
import {
  REGIME_PEAK_AUM_GBP, REGIME_PEAK_DATE, REGIME_STRESS_PCT, REGIME_HALT_PCT, STRESS_BANDS, STRESS_BUDGET_GBP,
  STRESS_EPISODE_HWM_BAND, NASDAQ_RECORD_CLOSE, NASDAQ_RECORD_DATE, HR_RED_PTS, HR_RELEASE_PTS, HALT_MARGIN_RED_PCT, INTRADAY_LABEL,
} from "@/config/signalRules";

export type RegimeKind = "NORMAL" | "STRESS" | "HALT";
export type RegimeRag = "GREEN" | "AMBER" | "RED";
export interface RegimeState {
  state: RegimeKind;
  band: string | null; // S1/S2/S3 while STRESS; "H-A" when HALT
  ddPct: number;
  haltLineGbp: number;
  haltMarginGbp: number;
  haltMarginPctAum: number;
  nasdaqDdPct: number | null;
  /** null = H-R NOT MEASURED (no ^IXIC quote). */
  hrGapPts: number | null;
  releasedGbp: number;
  releaseBand: string | null;
  rag: RegimeRag;
  newPeak: boolean;
  label: string;
  tooltip: string;
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const k = (x: number) => `£${Math.round(x / 1000).toLocaleString("en-GB")}k`;
const gbp = (x: number) => `£${Math.round(x).toLocaleString("en-GB")}`;

export function regimeState(i: { aumGbp: number; nasdaqLast: number | null | undefined; ixicHistoryMax?: number | null }): RegimeState {
  const newPeak = i.aumGbp > REGIME_PEAK_AUM_GBP;
  const ddRaw = newPeak ? 0 : (1 - i.aumGbp / REGIME_PEAK_AUM_GBP) * 100;
  // Bands test the exact DD; display rounds. HALT H-A is tested in whole pounds.
  const ddPct = r2(ddRaw);
  const haltLineGbp = REGIME_PEAK_AUM_GBP * (1 - REGIME_HALT_PCT / 100);
  const haltMarginGbp = i.aumGbp - haltLineGbp;
  const haltMarginPctAum = i.aumGbp > 0 ? (haltMarginGbp / i.aumGbp) * 100 : 0;

  let state: RegimeKind = "NORMAL";
  let band: string | null = null;
  if (i.aumGbp <= Math.round(haltLineGbp)) { state = "HALT"; band = "H-A"; }
  else if (ddRaw >= REGIME_STRESS_PCT) {
    state = "STRESS";
    band = STRESS_BANDS.find((b) => ddRaw >= b.from && ddRaw < b.to)?.id ?? STRESS_BANDS[STRESS_BANDS.length - 1].id;
  }

  let nasdaqDdPct: number | null = null, hrGapPts: number | null = null;
  if (i.nasdaqLast != null && Number.isFinite(i.nasdaqLast) && i.nasdaqLast > 0) {
    const peak = Math.max(NASDAQ_RECORD_CLOSE, i.ixicHistoryMax ?? 0, i.nasdaqLast);
    nasdaqDdPct = (1 - i.nasdaqLast / peak) * 100;
    hrGapPts = ddRaw - nasdaqDdPct;
  }

  // Released budget: deeper of current band and the episode high-water mark while STRESS/HALT.
  let releasedGbp = 0, releaseBand: string | null = null;
  if (state !== "NORMAL") {
    const idx = (id: string | null) => STRESS_BANDS.findIndex((b) => b.id === id);
    const cur = state === "HALT" ? STRESS_BANDS.length - 1 : idx(band);
    const b = STRESS_BANDS[Math.max(cur, idx(STRESS_EPISODE_HWM_BAND))];
    releaseBand = b.id;
    releasedGbp = STRESS_BUDGET_GBP * b.release;
  }

  let rag: RegimeRag = "GREEN";
  if (state === "HALT" || haltMarginPctAum < HALT_MARGIN_RED_PCT || (hrGapPts != null && hrGapPts > HR_RED_PTS)) rag = "RED";
  else if (state === "STRESS" || hrGapPts == null || hrGapPts > HR_RELEASE_PTS) rag = "AMBER";

  const head = state === "NORMAL" ? "NORMAL" : state === "HALT" ? "HALT H-A" : `STRESS ${band}`;
  const hr = hrGapPts == null ? "H-R NOT MEASURED" : `H-R ${hrGapPts.toFixed(1)}pt`;
  const label = `${head} · DD ${ddPct.toFixed(1)}% · HALT ${k(haltMarginGbp)} (${haltMarginPctAum.toFixed(1)}%) · ${hr}`;
  const tooltip = [
    `Peak ${gbp(REGIME_PEAK_AUM_GBP)} (${REGIME_PEAK_DATE})`,
    `H-A line ${gbp(haltLineGbp)} (DD ${REGIME_HALT_PCT}%)`,
    `H-R record ^IXIC ${NASDAQ_RECORD_CLOSE.toLocaleString("en-GB")} (${NASDAQ_RECORD_DATE})${nasdaqDdPct != null ? ` · Nasdaq DD ${nasdaqDdPct.toFixed(1)}%` : ""}`,
    `Released ${gbp(releasedGbp)}${releaseBand ? ` (${releaseBand} high-water mark)` : ""}`,
    hrGapPts != null ? `H-R: ${INTRADAY_LABEL}` : "H-R NOT MEASURED: no ^IXIC quote",
    newPeak ? "NEW PEAK: update REGIME_PEAK_AUM_GBP" : "",
  ].filter(Boolean).join("\n");

  return { state, band, ddPct, haltLineGbp, haltMarginGbp, haltMarginPctAum, nasdaqDdPct, hrGapPts, releasedGbp, releaseBand, rag, newPeak, label, tooltip };
}
