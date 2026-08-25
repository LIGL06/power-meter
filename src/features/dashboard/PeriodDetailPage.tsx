import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppData } from "@/state/useAppData";
import type { BillingPeriodDto } from "@/domain/types";
import { formatCurrency, formatKwh, formatShortDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/api";
import { billingRepository } from "@/data/repositories/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const SEASON_LABEL: Record<string, string> = { SUMMER: "Summer", NON_SUMMER: "Non-summer" };

export function PeriodDetailPage() {
  const { contract } = useAppData();
  const { periodId } = useParams<{ periodId: string }>();
  const [period, setPeriod] = useState<BillingPeriodDto | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contract || !periodId) return;
    let cancelled = false;
    setReady(false);
    billingRepository
      .period(contract.id, periodId)
      .then((res) => {
        if (!cancelled) setPeriod(res);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contract, periodId]);

  if (!contract) return null;

  const backLink = (
    <Link to="/" className="text-sm text-primary underline underline-offset-4 hover:text-primary/80">
      ← Back to Dashboard
    </Link>
  );

  if (!ready) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        {backLink}
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !period) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        {backLink}
        <p className="text-sm text-destructive">{error ?? "Period not found."}</p>
      </div>
    );
  }

  const currency = period.totals?.currency ?? "MXN";

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {backLink}
      <Card>
        <CardHeader>
          {/* startDate/expectedEndDate/actualEndDate are calendar-day boundaries (always UTC
              midnight), not moments in time — read their UTC date directly, matching the
              dashboard chart's same fix, rather than reinterpreting in the viewer's local
              timezone, which can shift them a day earlier. */}
          <CardTitle>
            Period {period.sequence} — {formatShortDate(period.startDate.slice(0, 10))} to{" "}
            {formatShortDate((period.actualEndDate ?? period.expectedEndDate).slice(0, 10))}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <Badge variant={period.status === "CLOSED" ? "secondary" : "outline"}>{period.status}</Badge>
            {period.estimatedClose && <Badge variant="outline">Rolled automatically</Badge>}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {period.totals ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Imported</p>
                  <p className="text-lg font-semibold">{formatKwh(period.totals.importedKwh)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Exported</p>
                  <p className="text-lg font-semibold">{formatKwh(period.totals.exportedKwh)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Billable</p>
                  <p className="text-lg font-semibold">{formatKwh(period.totals.billableKwh)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Energy charge</p>
                  <p className="text-lg font-semibold">{formatCurrency(period.totals.energyCharge, currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fixed charge</p>
                  <p className="text-lg font-semibold">{formatCurrency(period.totals.fixedCharge, currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tax</p>
                  <p className="text-lg font-semibold">{formatCurrency(period.totals.tax, currency)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm font-medium">
                  Total{period.totals.minimumChargeApplied && " (minimum charge applied)"}
                </span>
                <span className="text-xl font-semibold">{formatCurrency(period.totals.total, currency)}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">This period hasn&apos;t closed yet — no final totals.</p>
          )}
        </CardContent>
      </Card>

      {period.segments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Segments</CardTitle>
            <CardDescription>
              This period priced across {period.segments.length} segment{period.segments.length === 1 ? "" : "s"} —
              each locked to one tariff version at the time it was priced.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {period.segments.map((segment, index) => (
              <div key={index} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{SEASON_LABEL[segment.season] ?? segment.season}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatShortDate(segment.start.slice(0, 10))} – {formatShortDate(segment.end.slice(0, 10))} (
                      {segment.days} day
                      {segment.days === 1 ? "" : "s"})
                    </span>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(segment.charge, currency)}</span>
                </div>
                <ul className="flex flex-col gap-1 text-sm">
                  {segment.tiers.map((tier) => (
                    <li key={tier.name} className="flex items-center justify-between border-t pt-1 first:border-0 first:pt-0">
                      <span className="text-muted-foreground">
                        {tier.name} — {formatKwh(tier.kwh)} @ {formatCurrency(tier.pricePerKwh, currency)}/kWh
                      </span>
                      <span>{formatCurrency(tier.charge, currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
