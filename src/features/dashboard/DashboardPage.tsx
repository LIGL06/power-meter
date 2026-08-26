import { useMemo } from "react";
import { useAppData } from "@/state/useAppData";
import { formatCurrency, formatKwh } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ServerUnreachable } from "@/components/ServerUnreachable";
import { StatCard } from "./components/StatCard";
import { ConsumptionCostChart } from "./components/ConsumptionCostChart";

export function DashboardPage() {
  const { estimate, billingPeriods, historicalPeriodEntries, billingReady, serverUnreachable, retryConnection } =
    useAppData();

  const last3Closed = useMemo(
    () => billingPeriods.filter((p) => p.status === "CLOSED" && p.totals).slice(0, 3),
    [billingPeriods],
  );
  const avgPaid = last3Closed.length
    ? last3Closed.reduce((sum, p) => sum + p.totals!.total, 0) / last3Closed.length
    : null;
  const avgConsumption = last3Closed.length
    ? last3Closed.reduce((sum, p) => sum + p.totals!.importedKwh, 0) / last3Closed.length
    : null;
  const avgCurrency = last3Closed[0]?.totals?.currency;

  const projected = estimate?.projected ?? estimate?.actual;

  if (!billingReady) {
    if (serverUnreachable) {
      return <ServerUnreachable onRetry={retryConnection} />;
    }
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Avg. paid, last 3 periods"
          value={avgPaid !== null ? formatCurrency(avgPaid, avgCurrency) : "Not enough data yet"}
        />
        <StatCard
          label="Avg. consumption, last 3 periods"
          value={avgConsumption !== null ? formatKwh(avgConsumption) : "Not enough data yet"}
        />
        <StatCard
          label="Projected this period"
          value={projected ? formatCurrency(projected.total, projected.currency) : "Log a reading to see this"}
          hint={
            estimate
              ? `${estimate.period.daysRemaining} day${estimate.period.daysRemaining === 1 ? "" : "s"} remaining`
              : undefined
          }
        />
      </div>

      <ConsumptionCostChart periods={billingPeriods} historicalPeriodEntries={historicalPeriodEntries} />
    </div>
  );
}
