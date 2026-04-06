
ALTER TABLE public.score_rationales
ADD CONSTRAINT score_rationales_ticker_scored_at_key UNIQUE (ticker, scored_at);

ALTER TABLE public.disruption_rationales
ADD CONSTRAINT disruption_rationales_ticker_scored_at_key UNIQUE (ticker, scored_at);
