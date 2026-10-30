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

/** Doctrine strip deep link: scroll on Command, otherwise ?tab=<slug>&<params>. */
export function openDoctrineLink(link: { tab: string; params?: Record<string, string>; anchor?: string }) {
  const onCommand = !new URLSearchParams(window.location.search).get("tab") || new URLSearchParams(window.location.search).get("tab") === "command";
  if (link.tab === "command" && link.anchor && onCommand) {
    document.getElementById(link.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const params = new URLSearchParams();
  if (link.tab !== "command") params.set("tab", link.tab);
  for (const [k, v] of Object.entries(link.params ?? {})) params.set(k, v);
  const q = params.toString();
  window.history.pushState({}, "", `${window.location.pathname}${q ? `?${q}` : ""}${link.anchor ? `#${link.anchor}` : ""}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
