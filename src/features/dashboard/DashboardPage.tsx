import { useMemo } from "react";
import { useAppData } from "@/state/useAppData";
import { getPeriodsInRange } from "@/domain/periods";
import { addDays, todayISO } from "@/domain/date-utils";
import { formatCurrency, formatKwh } from "@/lib/format";
import { StatCard } from "./components/StatCard";
import { ConsumptionCostChart } from "./components/ConsumptionCostChart";

export function DashboardPage() {
  const { completedPeriods, projection, averages } = useAppData();

  const pastYearPeriods = useMemo(() => {
    const today = todayISO();
    return getPeriodsInRange(completedPeriods, addDays(today, -365), today);
  }, [completedPeriods]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Avg. paid, last 3 periods"
          value={averages.amountPaid !== null ? formatCurrency(averages.amountPaid) : "Not enough data yet"}
        />
        <StatCard
          label="Avg. consumption, last 3 periods"
          value={averages.consumptionKwh !== null ? formatKwh(averages.consumptionKwh) : "Not enough data yet"}
        />
        <StatCard
          label="Projected this period"
          value={projection ? formatCurrency(projection.projectedBill.totalAmount) : "Log a reading to see this"}
          hint={
            projection
              ? `${projection.daysRemaining} day${projection.daysRemaining === 1 ? "" : "s"} remaining`
              : undefined
          }
        />
      </div>

      <ConsumptionCostChart periods={pastYearPeriods} />
    </div>
  );
}
