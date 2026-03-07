import { Eye, TrendingUp, TrendingDown } from "lucide-react";
import { watchlist } from "@/data/portfolio";

const WatchlistTab = () => {
  return (
    <div className="space-y-6">
      <div className="panel-base p-5">
        <h3 className="font-ui text-xs uppercase tracking-[0.2em] text-muted-foreground mb-5 flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-primary" /> Watchlist
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlist.map((item) => (
            <div key={item.ticker} className="panel-elevated p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono-data text-base font-medium text-foreground">{item.ticker}</span>
                <span className={`rag-${item.rag}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {item.rag.toUpperCase()}
                </span>
              </div>
              <p className="font-ui text-xs text-muted-foreground mb-3">{item.name}</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-mono-data text-2xl text-foreground">£{item.price.toFixed(2)}</p>
                  <div className={`flex items-center gap-1 font-mono-data text-sm ${item.change >= 0 ? "text-success" : "text-destructive"}`}>
                    {item.change >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {item.change >= 0 ? "+" : ""}{item.change}%
                  </div>
                </div>
              </div>
              <p className="font-ui text-xs text-primary/80 mt-3 pt-3 border-t border-border/50">{item.signal}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WatchlistTab;
