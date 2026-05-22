import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { PortfolioData } from "@/hooks/usePortfolioData";
import type { PriceDataMap } from "@/hooks/useDailyPrices";
import HoldingFactSheet from "./HoldingFactSheet";

interface FactSheetCtx {
  open: (ticker: string) => void;
  close: () => void;
}

const Ctx = createContext<FactSheetCtx | null>(null);

export function useFactSheet(): FactSheetCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Soft fallback so triggers in components rendered before provider mount
    // (storybook/tests) don't crash the page.
    return { open: () => {}, close: () => {} };
  }
  return ctx;
}

interface ProviderProps {
  children: ReactNode;
  portfolio: PortfolioData;
  priceData: PriceDataMap;
}

export default function FactSheetProvider({ children, portfolio, priceData }: ProviderProps) {
  const [ticker, setTicker] = useState<string | null>(null);

  const open = useCallback((t: string) => {
    if (!t) return;
    setTicker(t);
  }, []);
  const close = useCallback(() => setTicker(null), []);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <HoldingFactSheet
        ticker={ticker}
        portfolio={portfolio}
        priceData={priceData}
        onClose={close}
      />
    </Ctx.Provider>
  );
}
