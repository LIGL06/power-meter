import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAppData } from "@/state/useAppData";
import type { Reading } from "@/domain/types";
import { localDateOf, localNoonISOInstant, todayISO } from "@/domain/date-utils";
import { formatKwh, formatShortDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/api";
import { readingsRepository, billingRepository } from "@/data/repositories/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createReadingSchema, type ReadingFormValues } from "./readingSchema";
import { ProjectionSummary } from "./components/ProjectionSummary";

export function ReadingEntryPage() {
  const { contract, estimate, billingReady, refetchBilling } = useAppData();
  const [latest, setLatest] = useState<Reading | undefined>(undefined);
  const [prior, setPrior] = useState<Reading | undefined>(undefined);
  const [readingsReady, setReadingsReady] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const today = todayISO();

  const fetchLatestReadings = useCallback(async () => {
    if (!contract) return;
    const res = await readingsRepository.list(contract.id, { limit: 2 });
    setLatest(res.items[0]);
    setPrior(res.items[1]);
  }, [contract]);

  useEffect(() => {
    if (!contract) return;
    let cancelled = false;
    fetchLatestReadings().finally(() => {
      if (!cancelled) setReadingsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [contract, fetchLatestReadings]);

  // Editing today's already-submitted reading validates against the day before it, not itself.
  // Also requires the reading's own period to still be the open one — closing a period early
  // on the same day a reading was posted leaves a "today" reading that belongs to a now-closed
  // period, which the API refuses to edit; that case must fall through to a fresh create instead.
  const isUpdatingToday =
    !!latest && localDateOf(latest.readAt) === today && (!estimate || latest.billingPeriodId === estimate.period.id);
  const baseline = isUpdatingToday ? prior : latest;

  const schema = useMemo(
    () => createReadingSchema(baseline?.importIndex, baseline?.exportIndex ?? undefined, contract?.hasExports ?? false),
    [baseline, contract?.hasExports],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReadingFormValues>({ resolver: zodResolver(schema) });

  // RHF captures defaultValues once at mount; since the latest reading loads
  // asynchronously (and changes after every mutation), the form is explicitly
  // re-synced here instead.
  useEffect(() => {
    if (!readingsReady) return;
    reset({
      importIndex: isUpdatingToday ? latest?.importIndex : undefined,
      exportIndex: isUpdatingToday ? (latest?.exportIndex ?? undefined) : undefined,
    });
  }, [readingsReady, isUpdatingToday, latest, reset]);

  async function onSubmit(values: ReadingFormValues) {
    if (!contract) return;
    try {
      if (isUpdatingToday && latest) {
        await readingsRepository.update(latest.id, {
          importIndex: values.importIndex,
          exportIndex: contract.hasExports ? values.exportIndex : undefined,
        });
      } else {
        await readingsRepository.create(contract.id, {
          type: "PARTIAL",
          readAt: localNoonISOInstant(),
          importIndex: values.importIndex,
          exportIndex: contract.hasExports ? values.exportIndex : undefined,
        });
      }
      toast.success("Reading saved");
      await Promise.all([fetchLatestReadings(), refetchBilling()]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleClosePeriod() {
    if (!contract) return;
    setIsClosing(true);
    try {
      await billingRepository.closeCurrent(contract.id);
      toast.success("Period closed");
      await Promise.all([fetchLatestReadings(), refetchBilling()]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsClosing(false);
    }
  }

  if (!contract) return null;

  if (!readingsReady || !billingReady) {
    return (
      <div className="flex max-w-md flex-col gap-6">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Log today's reading</CardTitle>
          <CardDescription>
            {formatShortDate(today)}
            {baseline && ` — last logged ${formatShortDate(baseline.readAt)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="importIndex">Meter reading (kWh)</FieldLabel>
              <Input
                id="importIndex"
                type="number"
                step="0.1"
                aria-invalid={!!errors.importIndex}
                {...register("importIndex", { valueAsNumber: true })}
              />
              {baseline && <FieldDescription>Last: {formatKwh(baseline.importIndex)}</FieldDescription>}
              <FieldError errors={errors.importIndex ? [errors.importIndex] : undefined} />
            </Field>

            {contract.hasExports && (
              <Field>
                <FieldLabel htmlFor="exportIndex">Export reading (kWh)</FieldLabel>
                <Input
                  id="exportIndex"
                  type="number"
                  step="0.1"
                  aria-invalid={!!errors.exportIndex}
                  {...register("exportIndex", { valueAsNumber: true })}
                />
                {baseline?.exportIndex != null && <FieldDescription>Last: {formatKwh(baseline.exportIndex)}</FieldDescription>}
                <FieldError errors={errors.exportIndex ? [errors.exportIndex] : undefined} />
              </Field>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-fit">
              {isUpdatingToday ? "Update today's reading" : "Save reading"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ProjectionSummary estimate={estimate} onClosePeriod={handleClosePeriod} isClosing={isClosing} />
    </div>
  );
}
