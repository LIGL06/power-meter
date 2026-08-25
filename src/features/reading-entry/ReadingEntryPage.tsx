import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { ServerUnreachable } from "@/components/ServerUnreachable";
import { createReadingSchema, type ReadingFormValues } from "./readingSchema";
import { ProjectionSummary } from "./components/ProjectionSummary";

export function ReadingEntryPage() {
  const { contract, estimate, billingReady, refetchBilling, serverUnreachable, retryConnection } = useAppData();
  const [latest, setLatest] = useState<Reading | undefined>(undefined);
  const [prior, setPrior] = useState<Reading | undefined>(undefined);
  const [readingsReady, setReadingsReady] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const today = todayISO();

  // The target date lives outside react-hook-form: whether it's editing an existing
  // reading or creating a new one changes which zod schema applies (different monotonic
  // baseline), and that schema has to be known before the form can be constructed —
  // keeping the date as plain state sidesteps that ordering problem entirely.
  const [selectedDate, setSelectedDate] = useState(today);

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

  // A picked date matching the latest reading's own date means "edit that reading,"
  // validated against the day before it (prior) rather than itself — also requires the
  // reading's own period to still be the open one, since closing a period early on the
  // same day a reading was posted leaves it belonging to a now-closed period, which the
  // API refuses to edit; that case must fall through to a fresh create instead.
  function isEditTargetDate(date: string): boolean {
    return !!latest && date === localDateOf(latest.readAt) && (!estimate || latest.billingPeriodId === estimate.period.id);
  }
  const isEditingSelected = isEditTargetDate(selectedDate);
  const baseline = isEditingSelected ? prior : latest;

  // Backfill is append-only (ui-features-v1.md architecture decision #1): the earliest
  // selectable date is the latest existing reading's own date (selecting it edits that
  // reading), or the period's start if there are no readings yet at all — never earlier,
  // which would mean inserting between two existing readings rather than appending.
  const minDate = latest ? localDateOf(latest.readAt) : (estimate?.period.startDate.slice(0, 10) ?? today);
  // The native <input min/max> only constrains the picker UI, not a typed or
  // programmatically-set value (confirmed live) — and this one is load-bearing, not just
  // a UX nicety: the API's create endpoint never re-derives a *later* reading's delta the
  // way an edit does, so an out-of-range submission wouldn't cleanly error, it would
  // silently leave the next reading's stored consumption wrong. Blocking submission here
  // is the only thing actually preventing that.
  const isDateOutOfRange = selectedDate < minDate || selectedDate > today;

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
  // asynchronously (and changes after every mutation, or as the selected date moves
  // into/out of editing an existing reading), the form is explicitly re-synced here.
  useEffect(() => {
    if (!readingsReady) return;
    reset({
      importIndex: isEditingSelected ? latest?.importIndex : undefined,
      exportIndex: isEditingSelected ? (latest?.exportIndex ?? undefined) : undefined,
    });
  }, [readingsReady, isEditingSelected, latest, reset]);

  async function onSubmit(values: ReadingFormValues) {
    if (!contract || isDateOutOfRange) return;
    try {
      if (isEditingSelected && latest) {
        await readingsRepository.update(latest.id, {
          importIndex: values.importIndex,
          exportIndex: contract.hasExports ? values.exportIndex : undefined,
        });
      } else {
        const readAt = localNoonISOInstant(selectedDate);
        // Fast-fail mirror of the server's own check — the server remains the final authority.
        if (estimate && new Date(readAt) < new Date(estimate.period.startDate)) {
          toast.error("This reading's date falls before the current billing period started.");
          return;
        }
        await readingsRepository.create(contract.id, {
          type: "PARTIAL",
          readAt,
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
    if (serverUnreachable) {
      return <ServerUnreachable onRetry={retryConnection} className="max-w-md" />;
    }
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
          <CardTitle>Log a reading</CardTitle>
          <CardDescription>
            {formatShortDate(selectedDate)}
            {baseline && ` — last logged ${formatShortDate(baseline.readAt)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="date">Date</FieldLabel>
              <Input
                id="date"
                type="date"
                min={minDate}
                max={today}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              {isDateOutOfRange ? (
                <FieldError
                  errors={[
                    {
                      message:
                        selectedDate > today
                          ? "Can't be in the future."
                          : `Can't be before ${formatShortDate(minDate)} — that would fall between two readings you've already logged.`,
                    },
                  ]}
                />
              ) : (
                <FieldDescription>
                  {isEditingSelected
                    ? selectedDate === today
                      ? "Today — already logged, editing it below."
                      : "Already logged for this date — editing it below."
                    : selectedDate === today
                      ? "Today"
                      : "Filling in a day you missed"}
                </FieldDescription>
              )}
            </Field>

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

            <Button type="submit" disabled={isSubmitting || isDateOutOfRange} className="w-fit">
              {isEditingSelected ? "Update reading" : "Save reading"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ProjectionSummary estimate={estimate} onClosePeriod={handleClosePeriod} isClosing={isClosing} />

      <Link to="/reading/history" className="text-sm text-primary underline underline-offset-4 hover:text-primary/80">
        View all readings →
      </Link>
    </div>
  );
}
