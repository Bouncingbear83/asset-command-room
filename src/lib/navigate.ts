/** Open the Actions tab filtered to a ticker via ?tab=actions&ticker= (no hash routing). */
export function openActionsForTicker(ticker: string) {
  const params = new URLSearchParams(window.location.search);
  params.set("tab", "actions");
  params.set("ticker", ticker);
  window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Open a vault note on the Vault tab via ?tab=vault&note=<path>. */
export function openVaultNote(path: string) {
  const params = new URLSearchParams(window.location.search);
  params.set("tab", "vault");
  params.set("note", path);
  window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
