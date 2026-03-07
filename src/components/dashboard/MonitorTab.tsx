import { Activity, Crosshair } from "lucide-react";
import { monitorMetrics, structuralTriggers } from "@/data/portfolio";

const RagChip = ({ rag, children }: { rag: "red" | "amber" | "green"; children: React.ReactNode }) => (
  <span className={`rag-${rag}`}>
    <span className="w-1.5 h-1.5 rounded-full bg-current" />
    {children}
  </span>
);

const MonitorTab = () => {
  return (
    <div className="space-y-6">
      {/* Cost Curve Metrics */}
      <div className="panel-base p-5">
        <h3 className="font-ui text-xs uppercase tracking-[0.2em] text-muted-foreground mb-5 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-primary" /> Cost Curve Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monitorMetrics.map((metric) => (
            <div key={metric.name} className="panel-elevated p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-ui text-xs text-muted-foreground">{metric.name}</span>
                <RagChip rag={metric.rag}>{metric.rag.toUpperCase()}</RagChip>
              </div>
              <p className="font-mono-data text-xl text-foreground">{metric.value}</p>
              <p className="font-ui text-xs text-muted-foreground">{metric.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Structural Triggers */}
      <div className="panel-base p-5">
        <h3 className="font-ui text-xs uppercase tracking-[0.2em] text-muted-foreground mb-5 flex items-center gap-2">
          <Crosshair className="w-3.5 h-3.5 text-primary" /> Structural Triggers
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-ui text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">Trigger</th>
                <th className="text-left font-ui text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">Condition</th>
                <th className="text-left font-ui text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">Current Status</th>
                <th className="text-center font-ui text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">RAG</th>
              </tr>
            </thead>
            <tbody>
              {structuralTriggers.map((t) => (
                <tr key={t.trigger} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-ui text-sm text-foreground">{t.trigger}</td>
                  <td className="py-3 px-4 font-mono-data text-sm text-muted-foreground">{t.condition}</td>
                  <td className="py-3 px-4 font-mono-data text-sm text-foreground">{t.status}</td>
                  <td className="py-3 px-4 text-center">
                    <RagChip rag={t.rag}>{t.rag.toUpperCase()}</RagChip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonitorTab;
