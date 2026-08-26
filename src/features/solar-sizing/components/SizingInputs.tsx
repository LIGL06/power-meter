import { formatKwh } from "@/lib/format";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SizingBasis = "average" | "peak";

interface SizingInputsProps {
  wattageW: number;
  onWattageChange: (value: number) => void;
  efficiencyPercent: number;
  onEfficiencyChange: (value: number) => void;
  peakSunHours: number | undefined;
  onPeakSunHoursChange: (value: number | undefined) => void;
  basis: SizingBasis;
  onBasisChange: (basis: SizingBasis) => void;
  averageDailyKwh: number | null;
  peakDailyKwh: number | null;
}

export function SizingInputs({
  wattageW,
  onWattageChange,
  efficiencyPercent,
  onEfficiencyChange,
  peakSunHours,
  onPeakSunHoursChange,
  basis,
  onBasisChange,
  averageDailyKwh,
  peakDailyKwh,
}: SizingInputsProps) {
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="peakSunHours">Peak sun hours (your location)</FieldLabel>
        <Input
          id="peakSunHours"
          type="number"
          step="0.1"
          min="0"
          placeholder="e.g. 5"
          value={peakSunHours ?? ""}
          onChange={(e) => onPeakSunHoursChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
        <FieldDescription>
          From your utility, PVWatts, or an installer's quote — there's no built-in lookup, since a per-region figure
          isn't something to hardcode reliably.
        </FieldDescription>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="wattageW">Panel wattage (W)</FieldLabel>
          <Input
            id="wattageW"
            type="number"
            step="5"
            min="0"
            value={wattageW}
            onChange={(e) => onWattageChange(Number(e.target.value))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="efficiencyPercent">System efficiency (%)</FieldLabel>
          <Input
            id="efficiencyPercent"
            type="number"
            step="1"
            min="0"
            max="100"
            value={efficiencyPercent}
            onChange={(e) => onEfficiencyChange(Number(e.target.value))}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel>Sizing basis</FieldLabel>
        <Tabs value={basis} onValueChange={(value) => onBasisChange(value as SizingBasis)}>
          <TabsList>
            <TabsTrigger value="average">Average day</TabsTrigger>
            <TabsTrigger value="peak">Peak day</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid grid-cols-2 gap-4 pt-1 text-sm">
          <div className={basis === "average" ? "font-medium" : "text-muted-foreground"}>
            Average day: {averageDailyKwh !== null ? formatKwh(averageDailyKwh) : "not enough data yet"}
          </div>
          <div className={basis === "peak" ? "font-medium" : "text-muted-foreground"}>
            Peak day: {peakDailyKwh !== null ? formatKwh(peakDailyKwh) : "not enough data yet"}
          </div>
        </div>
        <FieldDescription>
          Peak day sizes for net-zero even on your highest-usage day so far — more panels, but no import on a bad
          day. Average day sizes for typical usage instead.
        </FieldDescription>
      </Field>
    </div>
  );
}
