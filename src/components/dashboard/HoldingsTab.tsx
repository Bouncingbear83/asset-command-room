import { Briefcase } from "lucide-react";
import { sippHoldings, isaHoldings, portfolioSummary, type Holding } from "@/data/portfolio";

const HoldingsTable = ({ holdings, title, total }: { holdings: Holding[]; title: string; total: number }) => (
  <div className="panel-base p-5">
    <div className="flex items-center justify-between mb-5">
      <h3 className="font-ui text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
        <Briefcase className="w-3.5 h-3.5 text-primary" /> {title}
      </h3>
      <span className="font-mono-data text-sm text-primary">£{total.toLocaleString()}</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {["Ticker", "Name", "Layer", "Shares", "Avg Cost", "Price", "Value", "Wt%", "Target", "P&L", "P&L%", "Yield", "Score"].map((h) => (
              <th key={h} className="text-left font-ui text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-2 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.ticker} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
              <td className="py-2.5 px-2 font-mono-data text-sm text-primary font-medium">{h.ticker}</td>
              <td className="py-2.5 px-2 font-ui text-xs text-foreground/80 max-w-[140px] truncate">{h.name}</td>
              <td className="py-2.5 px-2">
                <span className="font-ui text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                  {h.layer}
                </span>
              </td>
              <td className="py-2.5 px-2 font-mono-data text-xs text-foreground">{h.shares.toLocaleString()}</td>
              <td className="py-2.5 px-2 font-mono-data text-xs text-muted-foreground">£{h.avgCost.toFixed(2)}</td>
              <td className="py-2.5 px-2 font-mono-data text-xs text-foreground">£{h.currentPrice.toFixed(2)}</td>
              <td className="py-2.5 px-2 font-mono-data text-xs text-foreground font-medium">£{h.marketValue.toLocaleString()}</td>
              <td className="py-2.5 px-2 font-mono-data text-xs text-foreground">{h.weight}%</td>
              <td className="py-2.5 px-2 font-mono-data text-xs text-muted-foreground">{h.targetWeight}%</td>
              <td className={`py-2.5 px-2 font-mono-data text-xs font-medium ${h.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                {h.pnl >= 0 ? "+" : ""}£{h.pnl.toLocaleString()}
              </td>
              <td className={`py-2.5 px-2 font-mono-data text-xs ${h.pnlPercent >= 0 ? "text-success" : "text-destructive"}`}>
                {h.pnlPercent >= 0 ? "+" : ""}{h.pnlPercent}%
              </td>
              <td className="py-2.5 px-2 font-mono-data text-xs text-primary">{h.dividendYield}%</td>
              <td className="py-2.5 px-2">
                <span className={`font-mono-data text-xs font-medium ${
                  h.score >= 80 ? "text-success" : h.score >= 60 ? "text-primary" : "text-destructive"
                }`}>
                  {h.score}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const HoldingsTab = () => {
  return (
    <div className="space-y-6">
      <HoldingsTable holdings={sippHoldings} title="SIPP Holdings" total={portfolioSummary.sippValue} />
      <HoldingsTable holdings={isaHoldings} title="ISA Holdings" total={portfolioSummary.isaValue} />
    </div>
  );
};

export default HoldingsTab;
