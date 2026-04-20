CREATE TABLE public.watchlist_price_history (
  id bigserial PRIMARY KEY,
  ticker text NOT NULL,
  snapshot_date date NOT NULL,
  close_price numeric(18,6) NOT NULL,
  currency text NOT NULL,
  source text DEFAULT 'yfinance',
  created_at timestamptz DEFAULT now(),
  UNIQUE (ticker, snapshot_date)
);

CREATE INDEX idx_wph_ticker_date 
  ON watchlist_price_history (ticker, snapshot_date desc);

ALTER TABLE watchlist_price_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read price history
CREATE POLICY "Authenticated users can read watchlist_price_history"
ON public.watchlist_price_history
FOR SELECT
TO authenticated
USING (true);

-- Allow anon users to read price history (for public watchlist features)
CREATE POLICY "Anon users can read watchlist_price_history"
ON public.watchlist_price_history
FOR SELECT
TO anon
USING (true);