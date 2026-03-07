import { Star, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { scores } from "@/data/portfolio";

const TrendIcon = ({ trend }: { trend: "up" | "down" | "flat" }) => {
  if (trend === "up") return <TrendingUp className="w-3.5 h-3.5 text-success" />;
  if (trend === "down") return <TrendingDown className="w-3.5 h-3.5 text-destructive" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
};

const ScoreBar = ({ value, max = 100 }: { value: number; max?: number }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${(value / max) * 100}%`,
          backgroundColor: value >= 80 ? "hsl(var(--success))" : value >= 60 ? "hsl(var(--primary))" : "hsl(var(--destructive))",
        }}
      />
    </div>
    <span className="font-mono-data text-xs text-muted-foreground w-8 text-right">{value}</span>
  </div>
);

const ScoresTab = () => {
  return (
    <div className="space-y-6">
      <div className="panel-base p-5">
        <h3 className="font-ui text-xs uppercase tracking-[0.2em] text-muted-foreground mb-5 flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-primary" /> Holding Scores
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-ui text-xs uppercase tracking-wider text-muted-foreground py-3 px-3">Ticker</th>
                <th className="text-left font-ui text-xs uppercase tracking-wider text-muted-foreground py-3 px-3 hidden md:table-cell">Name</th>
                <th className="text-left font-ui text-xs uppercase tracking-wider text-muted-foreground py-3 px-3">Fundamentals</th>
                <th className="text-left font-ui text-xs uppercase tracking-wider text-muted-foreground py-3 px-3">Technicals</th>
                <th className="text-left font-ui text-xs uppercase tracking-wider text-muted-foreground py-3 px-3">Income</th>
                <th className="text-center font-ui text-xs uppercase tracking-wider text-muted-foreground py-3 px-3">Overall</th>
                <th className="text-center font-ui text-xs uppercase tracking-wider text-muted-foreground py-3 px-3">Trend</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s) => (
                <tr key={s.ticker} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-3 font-mono-data text-sm text-primary font-medium">{s.ticker}</td>
                  <td className="py-3 px-3 font-ui text-sm text-foreground/80 hidden md:table-cell">{s.name}</td>
                  <td className="py-3 px-3 w-32"><ScoreBar value={s.fundamentals} /></td>
                  <td className="py-3 px-3 w-32"><ScoreBar value={s.technicals} /></td>
                  <td className="py-3 px-3 w-32"><ScoreBar value={s.income} /></td>
                  <td className="py-3 px-3 text-center">
                    <span className={`font-mono-data text-sm font-medium ${
                      s.overall >= 80 ? "text-success" : s.overall >= 60 ? "text-primary" : "text-destructive"
                    }`}>
                      {s.overall}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center"><TrendIcon trend={s.trend} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ScoresTab;
