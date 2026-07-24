import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAppData } from "@/state/useAppData";
import { todayISO } from "@/domain/date-utils";
import { formatKwh, formatShortDate } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createReadingSchema, type ReadingFormValues } from "./readingSchema";
import { ProjectionSummary } from "./components/ProjectionSummary";

export function ReadingEntryPage() {
  const { readings, config, addReading, projection, currentPeriod } = useAppData();
  const today = todayISO();

  // readings is stored sorted ascending by date.
  const latestReading = readings[readings.length - 1];
  const todaysReading = latestReading?.date === today ? latestReading : undefined;
  // When editing today's already-submitted reading, validate against the reading before it, not itself.
  const priorReading = todaysReading ? readings[readings.length - 2] : latestReading;

  const schema = useMemo(
    () => createReadingSchema(priorReading?.consumptionReading, priorReading?.exportReading, config.solar.enabled),
    [priorReading, config.solar.enabled],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ReadingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      consumptionReading: todaysReading?.consumptionReading,
      exportReading: todaysReading?.exportReading,
    },
  });

  function onSubmit(values: ReadingFormValues) {
    addReading({
      consumptionReading: values.consumptionReading,
      exportReading: config.solar.enabled ? values.exportReading : undefined,
    });
    toast.success("Reading saved");
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Log today's reading</CardTitle>
          <CardDescription>
            {formatShortDate(today)}
            {priorReading && ` — last logged ${formatShortDate(priorReading.date)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="consumptionReading">Meter reading (kWh)</FieldLabel>
              <Input
                id="consumptionReading"
                type="number"
                step="0.1"
                aria-invalid={!!errors.consumptionReading}
                {...register("consumptionReading", { valueAsNumber: true })}
              />
              {priorReading && <FieldDescription>Last: {formatKwh(priorReading.consumptionReading)}</FieldDescription>}
              <FieldError errors={errors.consumptionReading ? [errors.consumptionReading] : undefined} />
            </Field>

            {config.solar.enabled && (
              <Field>
                <FieldLabel htmlFor="exportReading">Export reading (kWh)</FieldLabel>
                <Input
                  id="exportReading"
                  type="number"
                  step="0.1"
                  aria-invalid={!!errors.exportReading}
                  {...register("exportReading", { valueAsNumber: true })}
                />
                {priorReading?.exportReading !== undefined && (
                  <FieldDescription>Last: {formatKwh(priorReading.exportReading)}</FieldDescription>
                )}
                <FieldError errors={errors.exportReading ? [errors.exportReading] : undefined} />
              </Field>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-fit">
              {todaysReading ? "Update today's reading" : "Save reading"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ProjectionSummary projection={projection} currentPeriod={currentPeriod} periodDays={config.billingPeriodDays} />
    </div>
  );
}
