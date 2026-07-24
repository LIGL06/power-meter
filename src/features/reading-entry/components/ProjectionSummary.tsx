import type { BillingPeriod, BillingPeriodDays, PeriodProjection } from "@/domain/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatKwh } from "@/lib/format";

interface ProjectionSummaryProps {
  projection: PeriodProjection | null;
  currentPeriod: BillingPeriod | undefined;
  periodDays: BillingPeriodDays;
}

export function ProjectionSummary({ projection, currentPeriod, periodDays }: ProjectionSummaryProps) {
  if (!projection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current period estimate</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {currentPeriod
            ? "Log a reading within this billing period to see a projected total."
            : "Log your first reading to start tracking this billing period."}
        </CardContent>
      </Card>
    );
  }

  const { daysElapsed, daysRemaining, projectedConsumptionKwh, projectedBill } = projection;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current period estimate</CardTitle>
        <CardDescription>
          Day {daysElapsed} of {periodDays} &middot; {daysRemaining} day{daysRemaining === 1 ? "" : "s"} remaining
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Projected consumption</p>
          <p className="text-xl font-semibold">{formatKwh(projectedConsumptionKwh)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Projected total</p>
          <p className="text-xl font-semibold">{formatCurrency(projectedBill.totalAmount)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
