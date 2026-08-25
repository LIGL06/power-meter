import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAppData } from "@/state/useAppData";
import type { CreateTariffDto, TariffDto } from "@/domain/types";
import { getErrorMessage } from "@/lib/api";
import { tariffRepository } from "@/data/repositories/api";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeasonTiersField } from "./components/SeasonTiersField";
import {
  adminTariffSchema,
  BLANK_ADMIN_TARIFF,
  SEASON_LABEL,
  SEASON_ORDER,
  type AdminTariffFormValues,
} from "./adminTariffSchema";

function versionToFormValues(t: TariffDto): AdminTariffFormValues {
  return {
    code: t.code,
    name: t.name,
    category: t.category,
    currency: t.currency,
    effectiveFrom: t.effectiveFrom.slice(0, 10),
    effectiveTo: t.effectiveTo ? t.effectiveTo.slice(0, 10) : "",
    summerWindow: t.summerWindow,
    seasons: SEASON_ORDER.map((name) => {
      const season = t.seasons.find((s) => s.name === name);
      return season
        ? { name, subsidy: season.subsidy, tiers: season.tiers }
        : { name, subsidy: 0, tiers: [{ name: "unico", upToKwhPer30Days: null, pricePerKwh: 0 }] };
    }) as AdminTariffFormValues["seasons"],
    fixedCharge: t.fixedCharge,
    minimumCharge: t.minimumCharge,
    taxRate: t.taxRate,
    dacThresholdKwh: t.dacThresholdKwh,
    source: t.source,
    sourceUrl: t.sourceUrl ?? "",
  };
}

/** Fields shared by create (full DTO) and patch (everything but the version-identifying code/effectiveFrom). */
function commonFields(values: AdminTariffFormValues) {
  return {
    name: values.name,
    category: values.category,
    currency: values.currency,
    effectiveTo: values.effectiveTo ? new Date(values.effectiveTo).toISOString() : null,
    summerWindow: values.summerWindow,
    seasons: values.seasons,
    fixedCharge: values.fixedCharge,
    minimumCharge: values.minimumCharge,
    taxRate: values.taxRate,
    dacThresholdKwh: values.dacThresholdKwh,
    source: values.source,
    sourceUrl: values.sourceUrl || null,
  };
}

function VersionEditor() {
  // null = "publishing a new version" mode. The edit TARGET (not just its id) is the
  // source of truth so the reset-on-load effect below can depend on it directly.
  const [editTarget, setEditTarget] = useState<TariffDto | null>(null);
  const [filterCode, setFilterCode] = useState("1C");
  const [versions, setVersions] = useState<TariffDto[]>([]);
  const [versionsReady, setVersionsReady] = useState(false);
  const editingId = editTarget?.id ?? null;

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdminTariffFormValues>({ resolver: zodResolver(adminTariffSchema), defaultValues: BLANK_ADMIN_TARIFF });

  const loadVersions = useCallback((code: string) => {
    setVersionsReady(false);
    tariffRepository
      .list(code || undefined)
      .then(setVersions)
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => setVersionsReady(true));
  }, []);

  useEffect(() => {
    loadVersions(filterCode);
  }, [filterCode, loadVersions]);

  // Resetting here (rather than synchronously inside the "Edit"/"New version" click
  // handlers) was a real bug found in testing: called mid-event-handler, alongside the
  // setEditTarget/setEditingId update that also flips the code/effectiveFrom `disabled`
  // props, react-hook-form's reset silently no-op'd on several top-level fields (`name`,
  // `effectiveFrom` confirmed empty/wrong in a live check) while the nested tier fields
  // — driven by useFieldArray, which re-subscribes independently — updated fine. Deferring
  // to an effect keyed on the target itself is react-hook-form's documented pattern for
  // resetting with data that arrives (or changes) after the initial render.
  useEffect(() => {
    reset(editTarget ? versionToFormValues(editTarget) : { ...BLANK_ADMIN_TARIFF, code: filterCode || BLANK_ADMIN_TARIFF.code });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterCode is only meant to seed a *new* version's code, not to reset an in-progress edit when the list filter changes
  }, [editTarget, reset]);

  function handleEdit(version: TariffDto) {
    setEditTarget(version);
  }

  function handleNewVersion() {
    setEditTarget(null);
  }

  async function onSubmit(values: AdminTariffFormValues) {
    try {
      if (editingId) {
        await tariffRepository.update(editingId, commonFields(values));
        toast.success("Tariff version updated");
      } else {
        const dto: CreateTariffDto = {
          ...commonFields(values),
          code: values.code,
          effectiveFrom: new Date(values.effectiveFrom).toISOString(),
        };
        await tariffRepository.create(dto);
        toast.success("Tariff version published");
      }
      loadVersions(filterCode);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <Field className="max-w-40">
            <FieldLabel htmlFor="filterCode">Tariff code</FieldLabel>
            <Input id="filterCode" value={filterCode} onChange={(e) => setFilterCode(e.target.value.toUpperCase())} />
          </Field>
          <Button type="button" variant="outline" onClick={handleNewVersion}>
            New version
          </Button>
        </div>

        {!versionsReady ? (
          <Skeleton className="h-24 w-full" />
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No versions found for this code.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span>
                    {formatShortDate(v.effectiveFrom)} — {v.effectiveTo ? formatShortDate(v.effectiveTo) : "current"}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{v.source}</Badge>
                    {formatCurrency(v.fixedCharge, v.currency)} fixed
                  </span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleEdit(v)}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="text-sm font-medium">{editingId ? "Editing existing version" : "Publishing a new version"}</div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="code">Code</FieldLabel>
            <Input id="code" {...register("code")} disabled={!!editingId} aria-invalid={!!errors.code} />
            <FieldError errors={errors.code ? [errors.code] : undefined} />
          </Field>
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
            <FieldError errors={errors.name ? [errors.name] : undefined} />
          </Field>
          <Field>
            <FieldLabel htmlFor="category">Category</FieldLabel>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESIDENTIAL">Residential</SelectItem>
                    <SelectItem value="BUSINESS">Business</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="currency">Currency</FieldLabel>
            <Input id="currency" {...register("currency")} aria-invalid={!!errors.currency} />
            <FieldError errors={errors.currency ? [errors.currency] : undefined} />
          </Field>
          <Field>
            <FieldLabel htmlFor="effectiveFrom">Effective from</FieldLabel>
            <Input
              id="effectiveFrom"
              type="date"
              {...register("effectiveFrom")}
              disabled={!!editingId}
              aria-invalid={!!errors.effectiveFrom}
            />
            <FieldError errors={errors.effectiveFrom ? [errors.effectiveFrom] : undefined} />
          </Field>
          <Field>
            <FieldLabel htmlFor="effectiveTo">Effective to (blank = current)</FieldLabel>
            <Input id="effectiveTo" type="date" {...register("effectiveTo")} />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Summer window</FieldLabel>
          <div className="grid grid-cols-4 gap-2">
            <Field>
              <FieldLabel htmlFor="summerWindow.startMonth" className="text-xs">Start month</FieldLabel>
              <Input id="summerWindow.startMonth" type="number" step="1" {...register("summerWindow.startMonth", { valueAsNumber: true })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="summerWindow.startDay" className="text-xs">Start day</FieldLabel>
              <Input id="summerWindow.startDay" type="number" step="1" {...register("summerWindow.startDay", { valueAsNumber: true })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="summerWindow.endMonth" className="text-xs">End month</FieldLabel>
              <Input id="summerWindow.endMonth" type="number" step="1" {...register("summerWindow.endMonth", { valueAsNumber: true })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="summerWindow.endDay" className="text-xs">End day</FieldLabel>
              <Input id="summerWindow.endDay" type="number" step="1" {...register("summerWindow.endDay", { valueAsNumber: true })} />
            </Field>
          </div>
        </div>

        {([0, 1] as const).map((seasonIndex) => (
          <div key={seasonIndex} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Badge>{SEASON_LABEL[SEASON_ORDER[seasonIndex]]}</Badge>
              <Field orientation="horizontal" className="w-fit">
                <FieldLabel htmlFor={`seasons.${seasonIndex}.subsidy`} className="text-xs">
                  Subsidy ($/kWh)
                </FieldLabel>
                <Input
                  id={`seasons.${seasonIndex}.subsidy`}
                  type="number"
                  step="0.001"
                  className="w-24"
                  {...register(`seasons.${seasonIndex}.subsidy`, { valueAsNumber: true })}
                />
              </Field>
            </div>
            <SeasonTiersField control={control} register={register} errors={errors} seasonIndex={seasonIndex} />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="fixedCharge">Fixed charge</FieldLabel>
            <Input id="fixedCharge" type="number" step="0.01" {...register("fixedCharge", { valueAsNumber: true })} />
            <FieldError errors={errors.fixedCharge ? [errors.fixedCharge] : undefined} />
          </Field>
          <Field>
            <FieldLabel htmlFor="minimumCharge">Minimum charge</FieldLabel>
            <Input id="minimumCharge" type="number" step="0.01" {...register("minimumCharge", { valueAsNumber: true })} />
            <FieldError errors={errors.minimumCharge ? [errors.minimumCharge] : undefined} />
          </Field>
          <Field>
            <FieldLabel htmlFor="taxRate">Tax rate (fraction)</FieldLabel>
            <Input id="taxRate" type="number" step="0.01" {...register("taxRate", { valueAsNumber: true })} />
            <FieldError errors={errors.taxRate ? [errors.taxRate] : undefined} />
          </Field>
          <Field>
            <FieldLabel htmlFor="dacThresholdKwh">DAC threshold (blank = none)</FieldLabel>
            <Input
              id="dacThresholdKwh"
              type="number"
              step="1"
              {...register("dacThresholdKwh", {
                setValueAs: (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
              })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="source">Source</FieldLabel>
            <Controller
              control={control}
              name="source"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEED">Seed</SelectItem>
                    <SelectItem value="USER_PROVIDED">User provided</SelectItem>
                    <SelectItem value="PLACEHOLDER">Placeholder</SelectItem>
                    <SelectItem value="ESTIMATED">Estimated</SelectItem>
                    <SelectItem value="SCRAPED">Scraped</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sourceUrl">Source URL</FieldLabel>
            <Input id="sourceUrl" {...register("sourceUrl")} />
          </Field>
        </div>

        <FieldDescription>
          Code and effective-from date identify the version and can&apos;t be changed once it exists — publish a new
          version instead.
        </FieldDescription>

        <Button type="submit" disabled={isSubmitting} className="w-fit">
          {editingId ? "Save changes" : "Publish version"}
        </Button>
      </form>
    </div>
  );
}

function ImportPanel({ onImported }: { onImported: () => void }) {
  const [json, setJson] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  async function handleImport() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      toast.error("That's not valid JSON");
      return;
    }
    const tariffs = Array.isArray(parsed) ? parsed : (parsed as { tariffs?: unknown })?.tariffs;
    if (!Array.isArray(tariffs) || tariffs.length === 0) {
      toast.error("Expected a JSON array of tariff versions (or { tariffs: [...] })");
      return;
    }
    setIsImporting(true);
    try {
      const result = await tariffRepository.import({ tariffs: tariffs as CreateTariffDto[] });
      toast.success(`Imported ${result.inserted} version(s)${result.skipped ? `, skipped ${result.skipped} existing` : ""}`);
      setJson("");
      onImported();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <FieldDescription>
        Paste a JSON array of tariff versions (the same shape as the version editor's fields) for bulk append —
        the scraper's entry point. Existing (code, effectiveFrom) pairs are skipped.
      </FieldDescription>
      <textarea
        className="min-h-40 w-full rounded-lg border border-input bg-transparent p-2.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder='[{"code": "1C", "name": "Doméstica 1C", "category": "RESIDENTIAL", "effectiveFrom": "2026-11-01", "summerWindow": {...}, "seasons": [...]}]'
      />
      <Button type="button" onClick={handleImport} disabled={isImporting || !json.trim()} className="w-fit">
        Import
      </Button>
    </div>
  );
}

export function AdminTariffsPage() {
  const { user, contract } = useAppData();
  const [refreshKey, setRefreshKey] = useState(0);

  if (user?.role !== "ADMIN") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tariff Management</CardTitle>
        <CardDescription>Publish, correct, and bulk-import global rate plan versions.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        {!contract && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-sm">
            <span className="text-muted-foreground">No meter registered under your account.</span>
            <Button variant="outline" size="sm" render={<Link to="/onboarding" />}>
              Register one
            </Button>
          </div>
        )}
        <VersionEditor key={refreshKey} />
        <div className="border-t pt-6">
          <h3 className="mb-3 font-medium">Bulk import</h3>
          <ImportPanel onImported={() => setRefreshKey((k) => k + 1)} />
        </div>
      </CardContent>
    </Card>
  );
}
