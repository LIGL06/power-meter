import { Bar, BarChart, CartesianGrid, Line, LineChart, usePlotArea, useYAxisScale, XAxis, YAxis } from "recharts";
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
const MAX_BAR_WIDTH = 24;

/**
 * Draws the visible bars itself via recharts' own `useYAxisScale`/`usePlotArea` hooks,
 * rather than relying on `<Bar>`'s built-in rendering.
 *
 * Root-caused live: `<Bar>`'s own geometry pipeline renders bars with wildly wrong
 * heights (or none at all) in this app's recharts version — reproduces identically on
 * the untouched pre-Phase-5 chart with real non-zero data, so it predates and is
 * unrelated to the historical-periods work. Instrumenting recharts' own source
 * confirmed the underlying scale math (`useYAxisScale`, the same function `<Bar>`
 * itself calls internally) is correct; only `<Bar>`'s own commit-to-DOM step is
 * broken. `<Bar>` is kept in the tree (invisible) purely so the tooltip still has a
 * registered series to read from — every visible pixel comes from here instead.
 */
function ConsumptionBars({ data, onBarClick }: { data: ChartPoint[]; onBarClick: (point: ChartPoint) => void }) {
  const yScale = useYAxisScale();
  const plotArea = usePlotArea();

  if (!yScale || !plotArea || data.length === 0) return null;

  const zeroY = yScale(0) ?? plotArea.y + plotArea.height;
  const categoryWidth = plotArea.width / data.length;
  const barWidth = Math.min(MAX_BAR_WIDTH, categoryWidth * 0.6);

  return (
    <g>
      {data.map((point, index) => {
        const y = yScale(point.kwh);
        if (y === undefined) return null;
        const height = Math.max(zeroY - y, 0);
        const x = plotArea.x + index * categoryWidth + (categoryWidth - barWidth) / 2;
        return (
          <rect
            key={point.id}
            x={x}
            y={y}
            width={barWidth}
            height={height}
            rx={4}
            ry={4}
            fill="var(--color-kwh)"
            fillOpacity={point.historical ? HISTORICAL_FILL_OPACITY : 1}
            stroke={point.historical ? "var(--color-kwh)" : undefined}
            strokeDasharray={point.historical ? "3 2" : undefined}
            className="cursor-pointer"
            onClick={() => onBarClick(point)}
          />
        );
      })}
    </g>
  );
}

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
          {/* The invisible <Bar>'s own rendered path (kept only to register the "kwh" series for
              the tooltip) sits above ConsumptionBars' <rect> elements in paint order regardless of
              JSX order, and the hover-cursor overlay does too — both would otherwise swallow a
              click/hover before it reaches the real bar underneath. Confirmed live: tooltip hover
              doesn't depend on either (it tracks mouse-x against category bounds chart-wide), so
              disabling pointer-events on both is safe. */}
          <ChartContainer
            config={consumptionConfig}
            className="aspect-auto h-[160px] w-full [&_.recharts-tooltip-cursor]:pointer-events-none [&_.recharts-rectangle]:pointer-events-none"
          >
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
              {/* Registers the "kwh" series for the tooltip only — invisible and non-interactive.
                  ConsumptionBars draws every pixel that's actually seen or clicked. */}
              <Bar dataKey="kwh" fill="transparent" isAnimationActive={false} legendType="none" />
              <ConsumptionBars data={data} onBarClick={goToPeriod} />
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
