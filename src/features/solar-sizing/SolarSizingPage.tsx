import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/state/useAppData";
import type { Reading, TariffDto } from "@/domain/types";
import { getErrorMessage } from "@/lib/api";
import { readingsRepository, tariffRepository } from "@/data/repositories/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ServerUnreachable } from "@/components/ServerUnreachable";
import { SizingInputs, type SizingBasis } from "./components/SizingInputs";
import { PanelSizingTable } from "./components/PanelSizingTable";
import { buildSizingTable, dailyGenerationPerPanelKwh, peakDailyImportKwh } from "./domain/solarMath";

const DEFAULT_WATTAGE_W = 620;
const DEFAULT_EFFICIENCY_PERCENT = 85;

export function SolarSizingPage() {
  const { contract, estimate, billingReady, serverUnreachable, retryConnection } = useAppData();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [tariff, setTariff] = useState<TariffDto | null>(null);
  const [supportingDataReady, setSupportingDataReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [wattageW, setWattageW] = useState(DEFAULT_WATTAGE_W);
  const [efficiencyPercent, setEfficiencyPercent] = useState(DEFAULT_EFFICIENCY_PERCENT);
  const [peakSunHours, setPeakSunHours] = useState<number | undefined>(undefined);
  const [basis, setBasis] = useState<SizingBasis>("average");

  // Readings drive the peak-day basis (not provided by the API directly); the tariff's
  // fixedCharge/minimumCharge give the table's "pay only this" note a real figure.
  useEffect(() => {
    if (!contract || !estimate) return;
    let cancelled = false;
    setSupportingDataReady(false);
    Promise.all([
      readingsRepository.list(contract.id, { periodId: estimate.period.id, limit: 200 }),
      tariffRepository.resolve(contract.tariffCode),
    ])
      .then(([readingsRes, tariffRes]) => {
        if (cancelled) return;
        setReadings(readingsRes.items);
        setTariff(tariffRes);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setSupportingDataReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contract, estimate]);

  const averageDailyKwh = estimate?.projectionAvailable ? estimate.dailyAverage.importKwh : null;
  const peakDailyKwh = useMemo(() => peakDailyImportKwh(readings), [readings]);
  const dailyConsumptionKwh = basis === "average" ? averageDailyKwh : peakDailyKwh;

  const perPanelKwh = peakSunHours
    ? dailyGenerationPerPanelKwh(wattageW, efficiencyPercent / 100, peakSunHours)
    : null;

  const rows = useMemo(
    () =>
      dailyConsumptionKwh && perPanelKwh && contract
        ? buildSizingTable(dailyConsumptionKwh, perPanelKwh, contract.periodDays)
        : [],
    [dailyConsumptionKwh, perPanelKwh, contract],
  );

  const flatChargeAmount = tariff ? Math.max(tariff.fixedCharge, tariff.minimumCharge) : 0;

  const tableEmptyMessage = !peakSunHours
    ? "Enter peak sun hours above to see the sizing table."
    : `Not enough data yet for the "${basis === "average" ? "Average day" : "Peak day"}" basis — log a few readings first, or switch basis.`;

  if (!contract) return null;

  if (!billingReady || !supportingDataReady) {
    if (serverUnreachable) {
      return <ServerUnreachable onRetry={retryConnection} className="max-w-2xl" />;
    }
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Solar Sizing</CardTitle>
          <CardDescription>
            A planning tool, not a certified engineering estimate — how many panels would it take to drive your net
            import to ~0 kWh, so the period only bills the fixed/minimum charge. Sizes against import consumption
            only; it doesn't simulate banked-export carry-forward — once panels are installed, the real dashboard
            estimate already handles that.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : (
            <SizingInputs
              wattageW={wattageW}
              onWattageChange={setWattageW}
              efficiencyPercent={efficiencyPercent}
              onEfficiencyChange={setEfficiencyPercent}
              peakSunHours={peakSunHours}
              onPeakSunHoursChange={setPeakSunHours}
              basis={basis}
              onBasisChange={setBasis}
              averageDailyKwh={averageDailyKwh}
              peakDailyKwh={peakDailyKwh}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sizing table</CardTitle>
          <CardDescription>
            Rows run from 1 panel through the first to fully offset your usage, plus two more.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PanelSizingTable
            rows={rows}
            periodDays={contract.periodDays}
            flatChargeAmount={flatChargeAmount}
            currency={tariff?.currency ?? "MXN"}
            emptyMessage={tableEmptyMessage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
