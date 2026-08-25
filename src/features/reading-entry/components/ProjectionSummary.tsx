import { useState } from "react";
import type { EstimateDto } from "@/domain/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatKwh } from "@/lib/format";

interface ProjectionSummaryProps {
  estimate: EstimateDto | null;
  onClosePeriod: () => void;
  isClosing: boolean;
}

export function ProjectionSummary({ estimate, onClosePeriod, isClosing }: ProjectionSummaryProps) {
  const [confirming, setConfirming] = useState(false);

  if (!estimate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current period estimate</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Unable to load this period's estimate.</CardContent>
      </Card>
    );
  }

  const { period, dailyAverage } = estimate;
  const breakdown = estimate.projected ?? estimate.actual;
  const label = estimate.projectionAvailable ? "Projected" : "So far this period";

  function handleConfirmClose() {
    setConfirming(false);
    onClosePeriod();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current period estimate</CardTitle>
        <CardDescription>
          Day {period.daysElapsed} of {period.periodDays} &middot; {period.daysRemaining} day
          {period.daysRemaining === 1 ? "" : "s"} remaining
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{label} consumption</p>
            <p className="text-xl font-semibold">{formatKwh(breakdown.importedKwh)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label} total</p>
            <p className="text-xl font-semibold">{formatCurrency(breakdown.total, breakdown.currency)}</p>
          </div>
        </div>

        {!estimate.projectionAvailable && estimate.projectionUnavailableReason && (
          <p className="text-xs text-muted-foreground">{estimate.projectionUnavailableReason}</p>
        )}

        {estimate.lastReadingAt && (
          <p className="text-xs text-muted-foreground">
            Daily average: {formatKwh(dailyAverage.importKwh)} imported
            {dailyAverage.exportKwh > 0 && `, ${formatKwh(dailyAverage.exportKwh)} exported`}
          </p>
        )}

        <div className="border-t pt-3">
          {!confirming ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
              Close this period early
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Close using your latest reading?</span>
              <Button type="button" variant="destructive" size="sm" disabled={isClosing} onClick={handleConfirmClose}>
                {isClosing ? "Closing..." : "Confirm close"}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={isClosing} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
