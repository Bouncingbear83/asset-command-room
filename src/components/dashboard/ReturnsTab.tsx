import { TrendingUp } from "lucide-react";
import { returnsData } from "@/data/portfolio";

const ReturnCard = ({ label, value }: { label: string; value: number }) => (
  <div className="panel-elevated p-4 text-center">
    <p className="font-ui text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
    <p className={`font-mono-data text-2xl font-medium ${value >= 0 ? "text-success" : "text-destructive"}`}>
      {value >= 0 ? "+" : ""}{value}%
    </p>
  </div>
);

const ReturnsTab = () => {
  const maxReturn = Math.max(...returnsData.monthlyReturns.map((m) => Math.abs(m.return)));

  return (
    <div className="space-y-6">
      {/* Period Returns */}
      <div className="panel-base p-5">
        <h3 className="font-ui text-xs uppercase tracking-[0.2em] text-muted-foreground mb-5 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-primary" /> Period Returns
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <ReturnCard label="YTD" value={returnsData.ytd} />
          <ReturnCard label="1 Year" value={returnsData.oneYear} />
          <ReturnCard label="3 Year" value={returnsData.threeYear} />
          <ReturnCard label="5 Year" value={returnsData.fiveYear} />
          <ReturnCard label="Inception" value={returnsData.sinceInception} />
        </div>
      </div>

      {/* Monthly Returns Bar Chart */}
      <div className="panel-base p-5">
        <h3 className="font-ui text-xs uppercase tracking-[0.2em] text-muted-foreground mb-5">
          Monthly Returns (Last 12 Months)
        </h3>
        <div className="flex items-end gap-2 h-48">
          {returnsData.monthlyReturns.map((m) => {
            const height = (Math.abs(m.return) / maxReturn) * 100;
            const isPositive = m.return >= 0;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full relative">
                <div className="flex-1 flex items-end w-full justify-center">
                  <div className="relative w-full max-w-[32px] flex flex-col items-center" style={{ height: '100%' }}>
                    {isPositive ? (
                      <div className="mt-auto w-full rounded-t" style={{ height: `${height}%`, backgroundColor: 'hsl(var(--success))' }} />
                    ) : (
                      <div className="mt-auto w-full rounded-b" style={{ height: `${height}%`, backgroundColor: 'hsl(var(--destructive))' }} />
                    )}
                  </div>
                </div>
                <span className="font-mono-data text-[10px] text-muted-foreground mt-2">{m.month}</span>
                <span className={`font-mono-data text-[10px] ${isPositive ? "text-success" : "text-destructive"}`}>
                  {isPositive ? "+" : ""}{m.return}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ReturnsTab;
