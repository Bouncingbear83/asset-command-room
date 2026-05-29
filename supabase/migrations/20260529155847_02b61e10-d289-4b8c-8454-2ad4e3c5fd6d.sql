CREATE OR REPLACE FUNCTION public.get_missing_watchlist_tickers(tickers text[])
RETURNS text[]
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $function$
  select coalesce(array_agg(t), ARRAY[]::text[])
  from unnest(tickers) as t
  where t not in (
    select distinct ticker from watchlist_price_history
  );
$function$;