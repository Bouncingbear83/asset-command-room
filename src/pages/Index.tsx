import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, Monitor, Eye, Layers, Star, TrendingUp, Briefcase } from "lucide-react";
import CommandTab from "@/components/dashboard/CommandTab";
import MonitorTab from "@/components/dashboard/MonitorTab";
import WatchlistTab from "@/components/dashboard/WatchlistTab";
import LayersTab from "@/components/dashboard/LayersTab";
import ScoresTab from "@/components/dashboard/ScoresTab";
import ReturnsTab from "@/components/dashboard/ReturnsTab";
import HoldingsTab from "@/components/dashboard/HoldingsTab";
import { portfolioSummary } from "@/data/portfolio";

const tabs = [
  { value: "command", label: "Command", icon: Command },
  { value: "monitor", label: "Monitor", icon: Monitor },
  { value: "watchlist", label: "Watchlist", icon: Eye },
  { value: "layers", label: "Layers", icon: Layers },
  { value: "scores", label: "Scores", icon: Star },
  { value: "returns", label: "Returns", icon: TrendingUp },
  { value: "holdings", label: "Holdings", icon: Briefcase },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded gold-gradient flex items-center justify-center">
              <Star className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="font-display text-2xl font-light tracking-wide text-foreground">
              Stellar <span className="text-primary">Command</span>
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="text-right">
              <p className="font-ui text-[10px] uppercase tracking-wider text-muted-foreground">SIPP</p>
              <p className="font-mono-data text-sm text-foreground">£{portfolioSummary.sippValue.toLocaleString()}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-right">
              <p className="font-ui text-[10px] uppercase tracking-wider text-muted-foreground">ISA</p>
              <p className="font-mono-data text-sm text-foreground">£{portfolioSummary.isaValue.toLocaleString()}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-right">
              <p className="font-ui text-[10px] uppercase tracking-wider text-muted-foreground">Income</p>
              <p className="font-mono-data text-sm text-primary">£{portfolioSummary.annualIncome.toLocaleString()}/yr</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs defaultValue="command" className="space-y-6">
          <TabsList className="bg-card border border-border h-auto p-1 flex flex-wrap gap-0">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="font-ui text-xs uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground px-4 py-2.5 gap-1.5 rounded-md transition-all"
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="command"><CommandTab /></TabsContent>
          <TabsContent value="monitor"><MonitorTab /></TabsContent>
          <TabsContent value="watchlist"><WatchlistTab /></TabsContent>
          <TabsContent value="layers"><LayersTab /></TabsContent>
          <TabsContent value="scores"><ScoresTab /></TabsContent>
          <TabsContent value="returns"><ReturnsTab /></TabsContent>
          <TabsContent value="holdings"><HoldingsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
