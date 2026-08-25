import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import type { BillingPeriodDto } from "@/domain/types";
import { formatShortDate } from "@/lib/format";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ConsumptionCostChartProps {
  periods: BillingPeriodDto[];
}

const consumptionConfig = {
  kwh: { label: "Energy consumed", color: "var(--chart-1)" },
} satisfies ChartConfig;

const costConfig = {
  paid: { label: "Amount paid", color: "var(--chart-2)" },
} satisfies ChartConfig;

/**
 * Two aligned single-axis panels sharing the same period labels, rather than one
 * dual-axis chart — overlaying kWh and $ on separate y-scales would invent a visual
 * correlation between two unrelated units that isn't actually in the data.
 */
export function ConsumptionCostChart({ periods }: ConsumptionCostChartProps) {
  const navigate = useNavigate();

  const data = periods
    .filter((period) => period.status === "CLOSED" && period.totals)
    .reverse() // API returns newest-first; the chart wants chronological order.
    .map((period) => ({
      id: period.id,
      // startDate is a calendar-day boundary (always UTC midnight), not a moment in
      // time — read its UTC date directly rather than reinterpreting it in the
      // viewer's local timezone, which can shift it a day either direction.
      label: formatShortDate(period.startDate.slice(0, 10)),
      kwh: period.totals!.importedKwh,
      paid: period.totals!.total,
    }));

  function goToPeriod(point: { id?: string | number } | undefined) {
    if (point?.id) navigate(`/periods/${point.id}`);
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
        <CardDescription>Past year, by billing period — click a bar for the full breakdown</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Energy consumed (kWh)</p>
          <ChartContainer config={consumptionConfig} className="aspect-auto h-[160px] w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} hide />
              <YAxis tickLine={false} axisLine={false} width={36} domain={[0, "auto"]} />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              <Bar
                dataKey="kwh"
                fill="var(--color-kwh)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                className="cursor-pointer"
                onClick={goToPeriod}
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
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Line
                dataKey="paid"
                type="monotone"
                stroke="var(--color-paid)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--color-paid)" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
