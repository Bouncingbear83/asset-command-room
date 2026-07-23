import { type CSSProperties } from "react";
import { useTest5Warning, type Test5Row } from "@/hooks/useTest5Warning";

// ── Styles (matches Stellar design system) ──

const card: CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--rim)",
  marginBottom: 16,
};
const cardHeader: CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid var(--rim)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 8,
};
const cardTitle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
};
const cardBody: CSSProperties = { padding: "16px 20px" };
const monoSm: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.06em",
  color: "var(--text-dim)",
};
const monoVal: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.04em",
};
const monoTicker: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: "var(--text)",
};

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "\u2014";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function signalColour(signal: string): string {
  if (signal === "TRIGGERED") return "var(--red)";
  if (signal === "WATCH") return "var(--amber)";
  return "var(--green)";
}

function proximityBarStyle(
  pct: number | null,
  threshold: string
): CSSProperties {
  const width = Math.min(Math.max(pct ?? 0, 0), 100);
  let colour = "var(--green)";
  if (width >= 80) colour = "var(--red)";
  else if (width >= 50) colour = "var(--amber)";

  return {
    width: `${width}%`,
    height: 6,
    background: colour,
    borderRadius: 1,
    transition: "width 0.3s ease",
  };
}

// ── Proximity Bar ──

function ProximityBar({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  const clamped = Math.min(Math.max(value ?? 0, 0), 120);
  let colour = "var(--green)";
  if (clamped >= 100) colour = "var(--red)";
  else if (clamped >= 50) colour = "var(--amber)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ ...monoSm, fontSize: 8, width: 40, textAlign: "right" }}>
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--deep)",
          border: "1px solid var(--rim)",
          borderRadius: 1,
          position: "relative",
          overflow: "visible",
        }}
      >
        <div
          style={{
            width: `${Math.min(clamped, 100)}%`,
            height: "100%",
            background: colour,
            borderRadius: 1,
            transition: "width 0.3s ease",
          }}
        />
        {/* 80% / 100% threshold marker */}
        <div
          style={{
            position: "absolute",
            left: "100%",
            top: -2,
            width: 1,
            height: 10,
            background: "var(--red)",
            opacity: 0.5,
          }}
        />
      </div>
      <span
        style={{
          ...monoVal,
          fontSize: 9,
          width: 40,
          textAlign: "right",
          color: colour,
        }}
      >
        {value != null ? `${value.toFixed(0)}%` : "\u2014"}
      </span>
    </div>
  );
}

// ── Position Row ──

function Test5PositionRow({ row }: { row: Test5Row }) {
  return (
    <div
      style={{
        padding: "12px 20px",
        borderBottom: "1px solid var(--rim)",
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 12,
        alignItems: "start",
      }}
    >
      {/* Left: ticker info */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={monoTicker}>{row.ticker}</span>
          <span
            style={{
              ...monoSm,
              fontSize: 8,
              padding: "1px 6px",
              border: `1px solid ${signalColour(row.test5_signal)}`,
              color: signalColour(row.test5_signal),
              fontWeight: 700,
            }}
          >
            {row.test5_signal}
          </span>
        </div>
        <div style={{ ...monoSm, marginTop: 4, fontSize: 9 }}>
          {row.reclass_status}
        </div>
        <div style={{ ...monoSm, marginTop: 2, fontSize: 9 }}>
          Entry: {row.price_at_first_add?.toFixed(2) ?? "\u2014"}
        </div>
        <div style={{ ...monoSm, marginTop: 1, fontSize: 9 }}>
          Move: {fmtPct(row.price_move_pct)}
        </div>
        <div style={{ ...monoSm, marginTop: 1, fontSize: 9 }}>
          {row.months_elapsed?.toFixed(1) ?? "\u2014"}m elapsed
        </div>
      </div>

      {/* Right: proximity bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <ProximityBar value={row.price_proximity_pct} label="PRICE" />
        <ProximityBar value={row.time_proximity_pct} label="TIME" />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{ ...monoSm, fontSize: 8, width: 40, textAlign: "right" }}
          >
            P/E
          </span>
          <span
            style={{
              ...monoSm,
              fontSize: 8,
              color: "var(--amber)",
              fontStyle: "italic",
            }}
          >
            Manual check: entry P/E{" "}
            {row.entry_pe != null ? row.entry_pe.toFixed(1) : "\u2014"}x
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──

export default function Test5Panel() {
  const { data, triggered, watching, clear, loading, error, refresh } =
    useTest5Warning();

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.15em",
            color: "var(--accent)",
          }}
        >
          {"\u25cf"} LOADING TEST 5 DATA...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <span style={{ ...monoSm, color: "var(--amber)" }}>
          {"\u26a0"} {error}
        </span>
        <button
          onClick={refresh}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            padding: "3px 10px",
            marginLeft: 12,
            cursor: "pointer",
            border: "1px solid var(--accent)",
            background: "transparent",
            color: "var(--accent)",
          }}
        >
          RETRY
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header Stats ── */}
      <div
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          padding: "8px 0 12px",
          borderBottom: "1px solid var(--rim)",
          marginBottom: 16,
        }}
      >
        <div style={monoSm}>
          TRACKED{" "}
          <span style={{ ...monoVal, color: "var(--text)" }}>{data.length}</span>
        </div>
        <div style={monoSm}>
          TRIGGERED{" "}
          <span style={{ ...monoVal, color: "var(--red)" }}>
            {triggered.length}
          </span>
        </div>
        <div style={monoSm}>
          WATCHING{" "}
          <span style={{ ...monoVal, color: "var(--amber)" }}>
            {watching.length}
          </span>
        </div>
        <div style={monoSm}>
          CLEAR{" "}
          <span style={{ ...monoVal, color: "var(--green)" }}>
            {clear.length}
          </span>
        </div>
      </div>

      {/* ── Triggered Positions ── */}
      {triggered.length > 0 && (
        <div
          style={{
            ...card,
            borderColor: "var(--red)",
            borderWidth: 2,
          }}
        >
          <div
            style={{
              ...cardHeader,
              borderBottomColor: "var(--red)",
            }}
          >
            <span style={{ ...cardTitle, color: "var(--red)" }}>
              {"\u26a0"} TEST 5 TRIGGERED: verify P/E expansion manually
            </span>
          </div>
          {triggered.map((row) => (
            <Test5PositionRow key={row.ticker} row={row} />
          ))}
        </div>
      )}

      {/* ── Watching Positions ── */}
      {watching.length > 0 && (
        <div style={card}>
          <div style={cardHeader}>
            <span style={{ ...cardTitle, color: "var(--amber)" }}>
              APPROACHING THRESHOLDS
            </span>
            <span style={{ ...monoSm, fontSize: 9 }}>
              Price proximity {"\u2265"}50% AND within 18m window
            </span>
          </div>
          {watching.map((row) => (
            <Test5PositionRow key={row.ticker} row={row} />
          ))}
        </div>
      )}

      {/* ── Clear Positions ── */}
      {clear.length > 0 && (
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>CLEAR</span>
          </div>
          <div style={cardBody}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
              }}
            >
              <thead>
                <tr>
                  {["Ticker", "Reclass", "Price Move", "Price Prox", "Time", "Time Prox"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          ...monoSm,
                          padding: "6px 8px",
                          textAlign: h === "Ticker" ? "left" : "right",
                          borderBottom: "1px solid var(--rim)",
                          fontWeight: 700,
                          fontSize: 9,
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {clear.map((row) => (
                  <tr key={row.ticker}>
                    <td
                      style={{
                        ...monoTicker,
                        padding: "5px 8px",
                        fontSize: 10,
                        borderBottom: "1px solid var(--rim)",
                      }}
                    >
                      {row.ticker}
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "5px 8px",
                        fontSize: 10,
                        borderBottom: "1px solid var(--rim)",
                        color: "var(--text-dim)",
                      }}
                    >
                      {row.reclass_status}
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "5px 8px",
                        color:
                          (row.price_move_pct ?? 0) >= 0
                            ? "var(--green)"
                            : "var(--red)",
                        borderBottom: "1px solid var(--rim)",
                      }}
                    >
                      {fmtPct(row.price_move_pct)}
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "5px 8px",
                        borderBottom: "1px solid var(--rim)",
                        color:
                          (row.price_proximity_pct ?? 0) >= 50
                            ? "var(--amber)"
                            : "var(--text-dim)",
                      }}
                    >
                      {row.price_proximity_pct?.toFixed(0) ?? "\u2014"}%
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "5px 8px",
                        borderBottom: "1px solid var(--rim)",
                      }}
                    >
                      {row.months_elapsed?.toFixed(1) ?? "\u2014"}m
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "5px 8px",
                        borderBottom: "1px solid var(--rim)",
                        color:
                          (row.time_proximity_pct ?? 0) >= 80
                            ? "var(--amber)"
                            : "var(--text-dim)",
                      }}
                    >
                      {row.time_proximity_pct?.toFixed(0) ?? "\u2014"}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div
        style={{
          ...monoSm,
          fontSize: 9,
          padding: "8px 0",
          color: "var(--text-dim)",
          lineHeight: 1.6,
        }}
      >
        Test 5 (Cumulative Capture, OB v3.15 {"\u00a7"}3.3): strips PRM when
        spot {"\u2265"}80% above PRICE_AT_FIRST_ADD + P/E expanded {"\u2265"}50%
        + elapsed {"\u2264"}18m. Price and time proximity are automated; P/E
        expansion requires manual quarterly check.
      </div>
    </div>
  );
}
