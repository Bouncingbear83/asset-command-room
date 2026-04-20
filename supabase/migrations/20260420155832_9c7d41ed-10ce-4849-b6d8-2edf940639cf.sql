create or replace function get_missing_watchlist_tickers(tickers text[])
returns text[]
language sql
security definer
as $$
  select coalesce(array_agg(t), ARRAY[]::text[])
  from unnest(tickers) as t
  where t not in (
    select distinct ticker from watchlist_price_history
  );
$$;

grant execute on function get_missing_watchlist_tickers(text[]) to anon, authenticated, service_role;