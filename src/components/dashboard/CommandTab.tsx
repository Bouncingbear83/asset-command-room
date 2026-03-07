import { Rocket, RefreshCw, BarChart3, Shield, TrendingUp, AlertTriangle, Zap, Target } from "lucide-react";
import { goldenRules, portfolioSummary } from "@/data/portfolio";

const CommandTab = () => {
  const quickCommands = [
    { label: "Rebalance Check", icon: RefreshCw },
    { label: "Yield Report", icon: BarChart3 },
    { label: "Risk Scan", icon: Shield },
    { label: "Score Refresh", icon: TrendingUp },
  ];

  const bubbleFlags = [
    { label: "Tactical Overweight", severity: "amber" as const },
    { label: "ISA Allowance Open", severity: "amber" as const },
    { label: "Correlation Cluster", severity: "red" as const },
    { label: "Income On Track", severity: "green" as const },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Launch Section */}
      <div className="panel-elevated p-8 text-center glow-gold">
        <h2 className="font-display text-4xl font-light tracking-wide text-primary mb-2">
          Stellar Command
        </h2>
        <p className="font-mono-data text-sm text-muted-foreground mb-1">
          Portfolio Value
        </p>
        <p className="font-mono-data text-5xl font-medium text-foreground mb-1">
          £{portfolioSummary.totalValue.toLocaleString()}
        </p>
        <p className={`font-mono-data text-lg ${portfolioSummary.totalPnlPercent >= 0 ? "text-success" : "text-destructive"}`}>
          {portfolioSummary.totalPnlPercent >= 0 ? "+" : ""}
          £{portfolioSummary.totalPnl.toLocaleString()} ({portfolioSummary.totalPnlPercent}%)
        </p>
        <button className="mt-6 gold-gradient text-primary-foreground font-ui font-semibold px-8 py-3 rounded-lg text-sm tracking-wider uppercase hover:opacity-90 transition-opacity">
          <span className="flex items-center gap-2 justify-center">
            <Rocket className="w-4 h-4" />
            Launch Analysis
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Commands */}
        <div className="panel-base p-5">
          <h3 className="font-ui text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary" /> Quick Commands
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {quickCommands.map((cmd) => (
              <button
                key={cmd.label}
                className="panel-elevated p-4 flex flex-col items-center gap-2 hover:border-primary/40 transition-colors group"
              >
                <cmd.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="font-ui text-xs text-foreground">{cmd.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Risk Controls */}
        <div className="panel-base p-5">
          <h3 className="font-ui text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-primary" /> Risk Controls
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-ui text-sm text-foreground">Max Position Size</span>
              <span className="font-mono-data text-sm text-primary">8.0%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-ui text-sm text-foreground">Stop Loss Trigger</span>
              <span className="font-mono-data text-sm text-primary">-20%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-ui text-sm text-foreground">Cash Floor</span>
              <span className="font-mono-data text-sm text-primary">3.0%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-ui text-sm text-foreground">Sector Cap</span>
              <span className="font-mono-data text-sm text-primary">20%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-ui text-sm text-foreground">Layer Drift Limit</span>
              <span className="font-mono-data text-sm text-primary">±3%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bubble Flags */}
      <div className="panel-base p-5">
        <h3 className="font-ui text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-primary" /> Active Flags
        </h3>
        <div className="flex flex-wrap gap-2">
          {bubbleFlags.map((flag) => (
            <span key={flag.label} className={`rag-${flag.severity}`}>
              <span className={`w-1.5 h-1.5 rounded-full bg-current`} />
              {flag.label}
            </span>
          ))}
        </div>
      </div>

      {/* Golden Rules */}
      <div className="panel-base p-5">
        <h3 className="font-ui text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-primary" /> Golden Rules
        </h3>
        <div className="space-y-2">
          {goldenRules.map((rule, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
              <span className="font-mono-data text-xs text-primary mt-0.5">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-ui text-sm text-foreground/90">{rule}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommandTab;
