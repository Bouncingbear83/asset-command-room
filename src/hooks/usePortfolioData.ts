import { useState, useEffect } from "react";

const SHEET_ID = "1T2afEG3mLjxmonduDugHA5SlJ44-RBJmv0bxISfalNo";

const GIDS = {
  holdings:  "2109415850",
  watchlist: "408093485",
  layers:    "547494965",
  scores:    "496665408",
  returns:   "356224071",
};

async function fetchSheet(gid: string) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
  const res = await fetch(url);
  const text = await res.text();
  const json = JSON.parse(text.substring(47, text.length - 2));
  const cols = json.table.cols.map((c: any) => c.label);
  const rows = json.table.rows.map((r: any) => {
    const obj: Record<string, any> = {};
    r.c.forEach((cell: any, i: number) => {
      obj[cols[i]] = cell?.v ?? null;
    });
    return obj;
  });
  return rows;
}

export function usePortfolioData() {
  const [data, setData] = useState<{
    holdings: any[];
    watchlist: any[];
    layers: any[];
    scores: any[];
    lastUpdated: string | null;
    loading: boolean;
    error: string | null;
  }>({
    holdings: [],
    watchlist: [],
    layers: [],
    scores: [],
    lastUpdated: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function load() {
      try {
        const [holdings, watchlist, layers, scores] = await Promise.all([
          fetchSheet(GIDS.holdings),
          fetchSheet(GIDS.watchlist),
          fetchSheet(GIDS.layers),
          fetchSheet(GIDS.scores),
        ]);
        setData({
          holdings,
          watchlist,
          layers,
          scores,
          lastUpdated: new Date().toLocaleTimeString(),
          loading: false,
          error: null,
        });
      } catch (e: any) {
        setData(prev => ({ ...prev, loading: false, error: e.message }));
      }
    }
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return data;
}
