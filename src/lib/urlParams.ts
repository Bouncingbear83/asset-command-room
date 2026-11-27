/** Lenient URL params: treats a stray second "?" as "&" and merges "#a=b" hash params. */
export function readUrlParams(search?: string, hash?: string): URLSearchParams {
  const s = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const h = hash ?? (typeof window !== "undefined" ? window.location.hash : "");
  const params = new URLSearchParams(s.replace(/^\?/, "").replace(/\?/g, "&"));
  const hp = h.replace(/^#/, "");
  if (hp.includes("=")) new URLSearchParams(hp.replace(/\?/g, "&")).forEach((v, k) => { if (!params.has(k)) params.set(k, v); });
  return params;
}

export const isSegmentsDebug = (search?: string, hash?: string) => readUrlParams(search, hash).get("debug") === "segments";
