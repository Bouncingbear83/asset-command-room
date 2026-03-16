import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import { type IntelligenceState, type ParseResult, parseIntelligenceUpdate } from '@/utils/parseIntelligenceUpdate';

const STORAGE_KEY = 'stellar_intelligence_state';

const initialState: IntelligenceState = {
  lastUpdated: null,
  reviewType: null,
  macroContext: null,
  layerGaps: {},
  costCurves: {},
  structuralTriggers: {},
  disruptionWatch: {},
  riskControls: {},
  bubbleFlags: {},
  weeklyMarketTriggers: {},
  ipoWatch: {},
  tickerActions: [],
};

type Action =
  | { type: 'HYDRATE'; payload: Partial<IntelligenceState> }
  | { type: 'APPLY'; payload: Partial<IntelligenceState> };

function reducer(state: IntelligenceState, action: Action): IntelligenceState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...initialState, ...action.payload };
    case 'APPLY': {
      // Partial merge — only overwrite sections present in payload
      const next = { ...state };
      for (const [k, v] of Object.entries(action.payload)) {
        if (v !== undefined) {
          (next as any)[k] = v;
        }
      }
      return next;
    }
    default:
      return state;
  }
}

interface IntelligenceCtx {
  state: IntelligenceState;
  applyUpdate: (raw: string) => ParseResult;
  validate: (raw: string) => ParseResult;
}

const Context = createContext<IntelligenceCtx | null>(null);

export function IntelligenceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'HYDRATE', payload: parsed });
      }
    } catch {
      // Corrupted — ignore
    }
  }, []);

  const validate = (raw: string): ParseResult => {
    return parseIntelligenceUpdate(raw);
  };

  const applyUpdate = (raw: string): ParseResult => {
    const result = parseIntelligenceUpdate(raw);
    if (result.valid && result.data) {
      dispatch({ type: 'APPLY', payload: result.data });
      // Persist
      const next = { ...state };
      for (const [k, v] of Object.entries(result.data)) {
        if (v !== undefined) (next as any)[k] = v;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    return result;
  };

  return (
    <Context.Provider value={{ state, applyUpdate, validate }}>
      {children}
    </Context.Provider>
  );
}

export function useIntelligence() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useIntelligence must be used within IntelligenceProvider');
  return ctx;
}
