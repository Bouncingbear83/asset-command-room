// ── Intelligence Update JSON Parser ─────────────────────────────────────────

export interface MacroContext {
  sp500: number;
  nasdaq: number;
  vix: number;
  gold: number;
  silver: number;
  uraniumSpot: number;
  copper: number;
  oilBrent: string;
  headline: string;
  posture: string;
}

export interface LayerGap {
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  note: string;
  filled: string[];
  pending: string[];
}

export interface CostCurve {
  value: number;
  unit: string;
  amber: number;
  red: number;
  status: 'GREEN' | 'WATCH' | 'AMBER' | 'RED';
  source: string;
  updated: string;
}

export interface StructuralTrigger {
  current: string;
  amber: string;
  red: string;
  status: 'GREEN' | 'AMBER' | 'RED';
  note: string;
  updated: string;
}

export interface DisruptionItem {
  value: number | string;
  unit: string;
  amber: number | string;
  red: number | string;
  status: 'GREEN' | 'MONITOR' | 'AMBER' | 'RED';
  note: string;
  updated: string;
}

export interface RiskControl {
  threshold: string;
  status: 'PASS' | 'WATCH' | 'TRIGGERED';
  detail: string;
  currentPct?: number;
  ticker?: string;
}

export interface BubbleFlag {
  status: 'CLEAR' | 'MONITOR' | 'TRIGGERED';
  detail: string;
}

export interface WeeklyTrigger {
  status: 'CLEAR' | 'FIRED';
  note: string;
}

export interface IpoEntry {
  status: 'PRE-IPO' | 'IPO-WATCH' | 'FILED' | 'LISTED';
  layer: string;
  note: string;
}

export interface TickerAction {
  ticker: string;
  action: 'BUY' | 'SELL' | 'TRIM' | 'PENDING_BUY' | 'MONITOR' | 'REVIEW' | 'WATCHLIST' | 'EXIT';
  amount: string | null;
  reason: string;
}

export interface IntelligenceState {
  lastUpdated: string | null;
  reviewType: 'weekly' | 'monthly' | 'quarterly' | null;
  macroContext: MacroContext | null;
  layerGaps: Record<string, LayerGap>;
  costCurves: Record<string, CostCurve>;
  structuralTriggers: Record<string, StructuralTrigger>;
  disruptionWatch: Record<string, DisruptionItem>;
  riskControls: Record<string, RiskControl>;
  bubbleFlags: Record<string, BubbleFlag>;
  weeklyMarketTriggers: Record<string, WeeklyTrigger>;
  ipoWatch: Record<string, IpoEntry>;
  tickerActions: TickerAction[];
}

export interface ParseResult {
  valid: boolean;
  error?: string;
  summary?: string;
  data?: Partial<IntelligenceState>;
}

/** Convert snake_case keys to camelCase recursively for plain objects */
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function convertKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(convertKeys);
  if (obj !== null && typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      out[snakeToCamel(k)] = convertKeys(v);
    }
    return out;
  }
  return obj;
}

// Top-level key mapping from JSON snake_case to state camelCase
const KEY_MAP: Record<string, keyof IntelligenceState> = {
  update_date: 'lastUpdated',
  review_type: 'reviewType',
  macro_context: 'macroContext',
  layer_gaps: 'layerGaps',
  cost_curves: 'costCurves',
  structural_triggers: 'structuralTriggers',
  disruption_watch: 'disruptionWatch',
  risk_controls: 'riskControls',
  bubble_flags: 'bubbleFlags',
  weekly_market_triggers: 'weeklyMarketTriggers',
  ipo_watch: 'ipoWatch',
  ticker_actions: 'tickerActions',
};

export function parseIntelligenceUpdate(raw: string): ParseResult {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e: any) {
    const match = e.message?.match(/position (\d+)/);
    const pos = match ? ` near position ${match[1]}` : '';
    return { valid: false, error: `Invalid JSON${pos}: ${e.message}` };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'JSON must be an object' };
  }

  if (!parsed.schema_version) {
    return { valid: false, error: 'Missing schema_version' };
  }
  if (parsed.schema_version !== '2.0') {
    return { valid: false, error: `Unsupported schema_version: ${parsed.schema_version} (expected "2.0")` };
  }

  if (!parsed.update_date) {
    return { valid: false, error: 'Missing update_date' };
  }
  if (isNaN(Date.parse(parsed.update_date))) {
    return { valid: false, error: `Invalid update_date: ${parsed.update_date}` };
  }

  // Build partial state
  const data: Partial<IntelligenceState> = {};
  const counts: string[] = [];

  for (const [jsonKey, stateKey] of Object.entries(KEY_MAP)) {
    if (parsed[jsonKey] !== undefined) {
      const val = convertKeys(parsed[jsonKey]);
      (data as any)[stateKey] = val;

      // Count for summary
      if (stateKey === 'tickerActions' && Array.isArray(val)) {
        counts.push(`${val.length} action${val.length !== 1 ? 's' : ''}`);
      } else if (stateKey === 'macroContext') {
        counts.push('macro context');
      } else if (typeof val === 'object' && !Array.isArray(val) && val !== null) {
        const n = Object.keys(val).length;
        if (n > 0) {
          const label = jsonKey.replace(/_/g, ' ');
          counts.push(`${n} ${label}`);
        }
      }
    }
  }

  const summary = `Valid: ${parsed.update_date} ${parsed.review_type || ''} — ${counts.join(', ') || 'metadata only'}`;

  return { valid: true, summary, data };
}
