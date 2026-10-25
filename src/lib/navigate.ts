/** Open the Actions tab filtered to a ticker via ?tab=actions&ticker= (no hash routing). */
export function openActionsForTicker(ticker: string) {
  const params = new URLSearchParams(window.location.search);
  params.set("tab", "actions");
  params.set("ticker", ticker);
  window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
