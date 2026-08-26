import { formatCurrency, formatKwh } from "@/lib/format";
import type { SizingRow } from "../domain/solarMath";

interface PanelSizingTableProps {
  rows: SizingRow[];
  periodDays: number;
  /** The flat charge a fully-offset period would pay — max(fixedCharge, minimumCharge), the real number behind the "fixed/minimum charge only" note. */
  flatChargeAmount: number;
  currency: string;
  /** Why `rows` is empty — the page knows whether it's a missing input or missing data. */
  emptyMessage: string;
}

export function PanelSizingTable({ rows, periodDays, flatChargeAmount, currency, emptyMessage }: PanelSizingTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Panels</th>
            <th className="py-2 pr-3 font-medium">Generation/day</th>
            <th className="py-2 pr-3 font-medium">Generation/period</th>
            <th className="py-2 pr-3 font-medium">% of usage offset</th>
            <th className="py-2 pr-3 font-medium">Est. remaining import</th>
            <th className="py-2 pl-3 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.panels}
              className={row.clearsFullOffset ? "border-b bg-primary/5 last:border-0" : "border-b last:border-0"}
            >
              <td className="py-2 pr-3">{row.panels}</td>
              <td className="py-2 pr-3">{formatKwh(row.generationPerDayKwh)}</td>
              <td className="py-2 pr-3">
                {formatKwh(row.generationPerPeriodKwh)} ({periodDays}d)
              </td>
              <td className="py-2 pr-3">{Math.round(row.offsetPercent)}%</td>
              <td className="py-2 pr-3 text-muted-foreground">~{formatKwh(row.remainingImportKwh)}/day</td>
              <td className="py-2 pl-3 text-muted-foreground">
                {row.clearsFullOffset && `Fixed/minimum charge only (~${formatCurrency(flatChargeAmount, currency)})`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
