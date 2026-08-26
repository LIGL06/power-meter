import { Bar, BarChart, CartesianGrid, Line, LineChart, Rectangle, XAxis, YAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import type { BillingPeriodDto, HistoricalPeriodEntryDto } from "@/domain/types";
import { formatShortDate } from "@/lib/format";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ConsumptionCostChartProps {
  periods: BillingPeriodDto[];
  /** Manually-entered past bills from before the contract was tracked here (ui-features-v1.md Phase 5). */
  historicalPeriodEntries: HistoricalPeriodEntryDto[];
}

interface ChartPoint {
  id: string;
  sortKey: string;
  label: string;
  kwh: number;
  paid: number;
  /** Manually entered, not server-priced — drives the lighter fill and the tooltip note. */
  historical: boolean;
}

const consumptionConfig = {
  kwh: { label: "Energy consumed", color: "var(--chart-1)" },
} satisfies ChartConfig;

const costConfig = {
  paid: { label: "Amount paid", color: "var(--chart-2)" },
} satisfies ChartConfig;

const HISTORICAL_FILL_OPACITY = 0.45;

/**
 * Two aligned single-axis panels sharing the same period labels, rather than one
 * dual-axis chart — overlaying kWh and $ on separate y-scales would invent a visual
 * correlation between two unrelated units that isn't actually in the data.
 */
export function ConsumptionCostChart({ periods, historicalPeriodEntries }: ConsumptionCostChartProps) {
  const navigate = useNavigate();

  const realPoints: ChartPoint[] = periods
    .filter((period) => period.status === "CLOSED" && period.totals)
    .map((period) => ({
      id: period.id,
      // startDate is a calendar-day boundary (always UTC midnight), not a moment in
      // time — read its UTC date directly rather than reinterpreting it in the
      // viewer's local timezone, which can shift it a day either direction.
      sortKey: period.startDate.slice(0, 10),
      label: formatShortDate(period.startDate.slice(0, 10)),
      kwh: period.totals!.importedKwh,
      paid: period.totals!.total,
      historical: false,
    }));

  const historicalPoints: ChartPoint[] = historicalPeriodEntries.map((entry) => ({
    id: entry.id,
    sortKey: entry.startDate.slice(0, 10),
    label: formatShortDate(entry.startDate.slice(0, 10)),
    kwh: entry.importedKwh,
    paid: entry.total,
    historical: true,
  }));

  // Historical entries are always for bills before the contract's own tracked history
  // (ui-features-v1.md Phase 5 scope note) and real periods are always CLOSED-and-past,
  // so a plain chronological merge never interleaves the two in a confusing way.
  const data = [...historicalPoints, ...realPoints].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  function goToPeriod(point: { id?: string | number; historical?: boolean } | undefined) {
    // Historical entries aren't real periods — there's no detail page to send them to.
    if (point?.id && !point.historical) navigate(`/periods/${point.id}`);
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Consumption &amp; cost</CardTitle>
          <CardDescription>Past year, by billing period</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Not enough data yet — log a few daily readings to see trends here.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consumption &amp; cost</CardTitle>
        <CardDescription>
          Past year, by billing period — click a bar for the full breakdown. Lighter bars are manually entered past
          bills.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Energy consumed (kWh)</p>
          <ChartContainer config={consumptionConfig} className="aspect-auto h-[160px] w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} hide />
              <YAxis tickLine={false} axisLine={false} width={36} domain={[0, "auto"]} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    formatter={(value, _name, item) => (
                      <span className="flex items-center gap-1">
                        {String(value)} kWh
                        {item.payload?.historical && (
                          <span className="text-muted-foreground">(manually entered)</span>
                        )}
                      </span>
                    )}
                  />
                }
              />
              <Bar
                dataKey="kwh"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                className="cursor-pointer"
                onClick={goToPeriod}
                // recharts' default Rectangle renderer draws nothing at all for this Bar in this
                // app's recharts version (confirmed live, and confirmed pre-existing — reproduces
                // identically on the untouched pre-Phase-5 component with real non-zero data, so
                // it isn't something this phase introduced). Supplying the same Rectangle
                // explicitly via `shape` is the workaround that actually renders a bar; it also
                // gives a hook for the historical/real fill distinction below.
                shape={(shapeProps: { payload?: ChartPoint }) => {
                  const point = shapeProps.payload;
                  return (
                    <Rectangle
                      {...shapeProps}
                      fill="var(--color-kwh)"
                      fillOpacity={point?.historical ? HISTORICAL_FILL_OPACITY : 1}
                      stroke={point?.historical ? "var(--color-kwh)" : undefined}
                      strokeDasharray={point?.historical ? "3 2" : undefined}
                    />
                  );
                }}
              />
            </BarChart>
          </ChartContainer>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Amount paid ($, incl. tax)</p>
          <ChartContainer config={costConfig} className="aspect-auto h-[160px] w-full">
            <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={36} domain={[0, "auto"]} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="line"
                    formatter={(value, _name, item) => (
                      <span className="flex items-center gap-1">
                        {String(value)}
                        {item.payload?.historical && (
                          <span className="text-muted-foreground">(manually entered)</span>
                        )}
                      </span>
                    )}
                  />
                }
              />
              <Line
                dataKey="paid"
                type="monotone"
                stroke="var(--color-paid)"
                strokeWidth={2}
                dot={(props) => {
                  const point = props.payload as ChartPoint;
                  return (
                    <circle
                      key={point.id}
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill={point.historical ? "var(--background)" : "var(--color-paid)"}
                      stroke="var(--color-paid)"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
