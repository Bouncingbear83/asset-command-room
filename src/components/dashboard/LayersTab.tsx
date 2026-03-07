import { Layers } from "lucide-react";
import { layers } from "@/data/portfolio";

const LayersTab = () => {
  return (
    <div className="space-y-6">
      <div className="panel-base p-5">
        <h3 className="font-ui text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-primary" /> Portfolio Layers
        </h3>
        <div className="space-y-6">
          {layers.map((layer) => {
            const drift = layer.current - layer.target;
            const isOver = drift > 0;
            return (
              <div key={layer.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className="font-ui text-sm text-foreground">{layer.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono-data text-sm text-muted-foreground">
                      Target: {layer.target}%
                    </span>
                    <span className="font-mono-data text-sm text-foreground font-medium">
                      {layer.current}%
                    </span>
                    <span className={`font-mono-data text-xs px-2 py-0.5 rounded ${
                      Math.abs(drift) > 2 ? "text-destructive bg-destructive/10" :
                      Math.abs(drift) > 1 ? "text-warning bg-warning/10" :
                      "text-success bg-success/10"
                    }`}>
                      {isOver ? "+" : ""}{drift.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{
                      width: `${(layer.current / 60) * 100}%`,
                      backgroundColor: layer.color,
                    }}
                  />
                  <div
                    className="absolute inset-y-0 w-0.5 bg-foreground/40"
                    style={{ left: `${(layer.target / 60) * 100}%` }}
                    title={`Target: ${layer.target}%`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-8 pt-6 border-t border-border grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="font-mono-data text-2xl text-foreground">5</p>
            <p className="font-ui text-xs text-muted-foreground uppercase tracking-wider">Layers</p>
          </div>
          <div>
            <p className="font-mono-data text-2xl text-primary">2.1%</p>
            <p className="font-ui text-xs text-muted-foreground uppercase tracking-wider">Max Drift</p>
          </div>
          <div>
            <p className="font-mono-data text-2xl text-success">OK</p>
            <p className="font-ui text-xs text-muted-foreground uppercase tracking-wider">Status</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayersTab;
