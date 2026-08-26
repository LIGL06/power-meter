import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAppData } from "@/state/useAppData";
import { useLogout } from "@/state/useLogout";
import type { PeriodLength, ServiceAddress, TariffDto } from "@/domain/types";
import { todayISO } from "@/domain/date-utils";
import { getErrorMessage } from "@/lib/api";
import { contractRepository, historicalPeriodsRepository, tariffRepository, usersRepository } from "@/data/repositories/api";
import { formatCurrency, formatKwh, formatShortDate } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { profileSchema, historicalPeriodSchema, type ProfileFormValues, type HistoricalPeriodFormValues } from "./settingsSchema";

function LogoutButton() {
  const logout = useLogout();
  return <Button variant="outline" onClick={logout} className="w-full">Log out</Button>;
}

function ProfileTab() {
  const { user, setUser } = useAppData();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: user ? { firstName: user.firstName, lastName: user.lastName, email: user.email } : undefined,
  });

  async function onSubmit(values: ProfileFormValues) {
    if (!user) return;
    try {
      const updated = await usersRepository.update(user.id, values);
      setUser({ ...user, firstName: updated.firstName, lastName: updated.lastName, email: updated.email });
      toast.success("Profile saved");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="firstName">First name</FieldLabel>
        <Input id="firstName" {...register("firstName")} aria-invalid={!!errors.firstName} />
        <FieldError errors={errors.firstName ? [errors.firstName] : undefined} />
      </Field>
      <Field>
        <FieldLabel htmlFor="lastName">Last name</FieldLabel>
        <Input id="lastName" {...register("lastName")} aria-invalid={!!errors.lastName} />
        <FieldError errors={errors.lastName ? [errors.lastName] : undefined} />
      </Field>
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
        <FieldError errors={errors.email ? [errors.email] : undefined} />
      </Field>
      <FieldDescription>Password changes aren&apos;t available yet.</FieldDescription>
      <Button type="submit" disabled={isSubmitting} className="w-fit">
        Save profile
      </Button>
    </form>
  );
}

const SEASON_LABEL: Record<string, string> = { SUMMER: "Summer", NON_SUMMER: "Non-summer" };

/** Read-only — tariffs are a global, admin-managed catalog (see architecture decision #2 in api-implementation-v2.md). */
function TariffTab() {
  const { contract } = useAppData();
  const [tariff, setTariff] = useState<TariffDto | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contract) return;
    let cancelled = false;
    tariffRepository
      .resolve(contract.tariffCode)
      .then((res) => {
        if (!cancelled) setTariff(res);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contract]);

  if (!ready) {
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !tariff) {
    return <p className="text-sm text-destructive">{error ?? "No rate plan found for this contract."}</p>;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h3 className="font-medium">{tariff.name}</h3>
        <p className="text-sm text-muted-foreground">
          {tariff.code} · {tariff.category === "RESIDENTIAL" ? "Residential" : "Business"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field>
          <FieldLabel>Fixed charge</FieldLabel>
          <div className="text-sm">{formatCurrency(tariff.fixedCharge, tariff.currency)}</div>
        </Field>
        <Field>
          <FieldLabel>Minimum charge</FieldLabel>
          <div className="text-sm">{formatCurrency(tariff.minimumCharge, tariff.currency)}</div>
        </Field>
        <Field>
          <FieldLabel>Tax rate</FieldLabel>
          <div className="text-sm">{(tariff.taxRate * 100).toFixed(0)}%</div>
        </Field>
      </div>

      {tariff.seasons.map((season) => (
        <div key={season.name} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{SEASON_LABEL[season.name] ?? season.name}</Badge>
            {season.subsidy > 0 && (
              <span className="text-xs text-muted-foreground">
                Subsidy: {formatCurrency(season.subsidy, tariff.currency)}/kWh
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {season.tiers.map((tier) => (
              <li key={tier.name} className="flex items-center justify-between border-b py-1 last:border-0">
                <span className="text-muted-foreground">
                  {tier.name} — up to {tier.upToKwhPer30Days ?? "∞"} kWh/30 days
                </span>
                <span>{formatCurrency(tier.pricePerKwh, tariff.currency)}/kWh</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <FieldDescription>Rate plans are managed centrally and can&apos;t be edited here.</FieldDescription>
    </div>
  );
}

function SolarTab() {
  const { contract, setContract } = useAppData();
  const [hasExports, setHasExports] = useState(contract?.hasExports ?? false);
  const [isSaving, setIsSaving] = useState(false);

  if (!contract) return null;

  async function handleSave() {
    if (!contract) return;
    setIsSaving(true);
    try {
      const updated = await contractRepository.update(contract.id, { hasExports });
      setContract(updated);
      toast.success("Solar settings saved");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <Field orientation="horizontal">
        <FieldLabel htmlFor="solar-enabled">Solar panels / export register</FieldLabel>
        <Switch id="solar-enabled" checked={hasExports} onCheckedChange={setHasExports} />
      </Field>

      <Field>
        <FieldLabel>Banked export kWh</FieldLabel>
        <div className="text-sm">{formatKwh(contract.bankedExportKwh)}</div>
        <FieldDescription>
          Surplus exported energy carried forward to offset future imports. Managed automatically — there&apos;s no
          separate export credit rate.
        </FieldDescription>
      </Field>

      <FieldDescription>Changing this applies from the next billing period, not retroactively.</FieldDescription>

      <Button onClick={handleSave} disabled={isSaving || hasExports === contract.hasExports} className="w-fit">
        Save solar settings
      </Button>
    </div>
  );
}

function BillingTab() {
  const { contract, setContract } = useAppData();
  const [periodDays, setPeriodDays] = useState<PeriodLength>(contract?.periodDays ?? 30);
  const [isSaving, setIsSaving] = useState(false);

  if (!contract) return null;

  async function handleSave() {
    if (!contract) return;
    setIsSaving(true);
    try {
      const updated = await contractRepository.update(contract.id, { periodDays });
      setContract(updated);
      toast.success("Billing period saved");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="billingPeriodDays">Billing period length</FieldLabel>
        <Select value={String(periodDays)} onValueChange={(value) => setPeriodDays(Number(value) as PeriodLength)}>
          <SelectTrigger id="billingPeriodDays" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="60">60 days</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <FieldDescription>
        Applies starting the next billing period — the one in progress isn&apos;t recalculated.
      </FieldDescription>
      <Button onClick={handleSave} disabled={isSaving || periodDays === contract.periodDays} className="w-fit">
        Save billing period
      </Button>
    </div>
  );
}

function formatAddress(address: NonNullable<ServiceAddress>): string {
  return [address.street, address.city, address.state, address.postalCode].filter(Boolean).join(", ");
}

/**
 * Manually-entered summaries of bills from before this meter was tracked here
 * (ui-features-v1.md Phase 5) — a lightweight, separate record from a real
 * BillingPeriod, since a manual entry can't honestly carry a real period's
 * invariants (tariff snapshot, reading linkage, sequential numbering).
 */
function PastBillsSection() {
  const { contract, historicalPeriodEntries, refetchBilling } = useAppData();
  const today = todayISO();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HistoricalPeriodFormValues>({ resolver: zodResolver(historicalPeriodSchema) });

  if (!contract) return null;

  async function onSubmit(values: HistoricalPeriodFormValues) {
    if (!contract) return;
    try {
      await historicalPeriodsRepository.create(contract.id, {
        // Bare calendar dates, parsed as UTC midnight — matches how billingAnchorDate
        // is submitted in onboarding, keeping every stored date a calendar-day boundary.
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
        importedKwh: values.importedKwh,
        exportedKwh: contract.hasExports ? values.exportedKwh : undefined,
        total: values.total,
        notes: values.notes || undefined,
      });
      toast.success("Past bill added");
      // A bare reset() (no values object) is the form the RHF docs actually clear uncontrolled
      // inputs with — passing `undefined` per-field for the number inputs left their DOM value
      // (and hence the visible text) unchanged, confirmed live.
      reset();
      await refetchBilling();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleDelete(entryId: string) {
    if (!contract) return;
    setDeletingId(entryId);
    try {
      await historicalPeriodsRepository.remove(contract.id, entryId);
      toast.success("Entry deleted");
      setConfirmingId(null);
      await refetchBilling();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <div>
        <FieldLabel>Past bills</FieldLabel>
        <FieldDescription>
          Bills you already have on paper from before you started tracking here — shown on the dashboard chart
          alongside real billing periods, but kept separate: nothing here is priced or reconciled against your rate
          plan.
        </FieldDescription>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="hp-startDate">Start date</FieldLabel>
            <Input id="hp-startDate" type="date" max={today} {...register("startDate")} aria-invalid={!!errors.startDate} />
            <FieldError errors={errors.startDate ? [errors.startDate] : undefined} />
          </Field>
          <Field>
            <FieldLabel htmlFor="hp-endDate">End date</FieldLabel>
            <Input id="hp-endDate" type="date" max={today} {...register("endDate")} aria-invalid={!!errors.endDate} />
            <FieldError errors={errors.endDate ? [errors.endDate] : undefined} />
          </Field>
        </div>
        <FieldDescription>
          Meant for bills before you started tracking here — the app won&apos;t stop you from entering other dates,
          but a period that already overlaps real data will look odd on the chart.
        </FieldDescription>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="hp-importedKwh">Imported (kWh)</FieldLabel>
            <Input
              id="hp-importedKwh"
              type="number"
              step="0.1"
              aria-invalid={!!errors.importedKwh}
              {...register("importedKwh", { valueAsNumber: true })}
            />
            <FieldError errors={errors.importedKwh ? [errors.importedKwh] : undefined} />
          </Field>
          {contract.hasExports && (
            <Field>
              <FieldLabel htmlFor="hp-exportedKwh">Exported (kWh)</FieldLabel>
              <Input
                id="hp-exportedKwh"
                type="number"
                step="0.1"
                aria-invalid={!!errors.exportedKwh}
                {...register("exportedKwh", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
              />
              <FieldError errors={errors.exportedKwh ? [errors.exportedKwh] : undefined} />
            </Field>
          )}
        </div>

        <Field>
          <FieldLabel htmlFor="hp-total">Total billed</FieldLabel>
          <Input
            id="hp-total"
            type="number"
            step="0.01"
            aria-invalid={!!errors.total}
            {...register("total", { valueAsNumber: true })}
          />
          <FieldError errors={errors.total ? [errors.total] : undefined} />
        </Field>

        <Field>
          <FieldLabel htmlFor="hp-notes">Notes</FieldLabel>
          <Input id="hp-notes" placeholder="e.g. From paper bill" {...register("notes")} aria-invalid={!!errors.notes} />
          <FieldError errors={errors.notes ? [errors.notes] : undefined} />
        </Field>

        <Button type="submit" disabled={isSubmitting} className="w-fit">
          Add past bill
        </Button>
      </form>

      {historicalPeriodEntries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Period</th>
                <th className="py-2 pr-3 font-medium">Imported</th>
                <th className="py-2 pr-3 font-medium">Total</th>
                <th className="py-2 pr-3 font-medium">Notes</th>
                <th className="py-2 pl-3 text-right font-medium">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {historicalPeriodEntries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    {formatShortDate(entry.startDate.slice(0, 10))} – {formatShortDate(entry.endDate.slice(0, 10))}
                  </td>
                  <td className="py-2 pr-3">{formatKwh(entry.importedKwh)}</td>
                  <td className="py-2 pr-3">{formatCurrency(entry.total, entry.currency)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{entry.notes || "—"}</td>
                  <td className="py-2 pl-3 text-right">
                    {confirmingId === entry.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="destructive"
                          size="xs"
                          disabled={deletingId === entry.id}
                          onClick={() => handleDelete(entry.id)}
                        >
                          Confirm
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={deletingId === entry.id}
                          onClick={() => setConfirmingId(null)}
                        >
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <Button type="button" variant="ghost" size="xs" onClick={() => setConfirmingId(entry.id)}>
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Read-only contract detail (the immutable fields not shown on the Solar/Billing tabs) plus deactivation. */
function MeterTab() {
  const { contract, setContract } = useAppData();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  if (!contract) return null;

  async function handleDeactivate() {
    if (!contract) return;
    setIsDeactivating(true);
    try {
      await contractRepository.deactivate(contract.id);
      setContract(null);
      toast.success("Meter deactivated");
      navigate("/");
    } catch (error) {
      toast.error(getErrorMessage(error));
      setIsDeactivating(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Field>
        <FieldLabel>Service number</FieldLabel>
        <div className="text-sm">{contract.serviceNumber}</div>
      </Field>
      {contract.meterSerial && (
        <Field>
          <FieldLabel>Meter serial</FieldLabel>
          <div className="text-sm">{contract.meterSerial}</div>
        </Field>
      )}
      {contract.address && (
        <Field>
          <FieldLabel>Address</FieldLabel>
          <div className="text-sm">{formatAddress(contract.address)}</div>
        </Field>
      )}
      <Field>
        <FieldLabel>Customer type</FieldLabel>
        <div className="text-sm">{contract.customerType === "RESIDENTIAL" ? "Residential" : "Business"}</div>
      </Field>
      <Field>
        <FieldLabel>Billing period started</FieldLabel>
        {/* billingAnchorDate is a calendar-day boundary (always UTC midnight), not a moment
            in time — read its UTC date directly, matching the chart's same fix, rather than
            reinterpreting in the viewer's local timezone, which can shift it a day earlier. */}
        <div className="text-sm">{formatShortDate(contract.billingAnchorDate.slice(0, 10))}</div>
      </Field>
      <Field>
        <FieldLabel>Opening import index</FieldLabel>
        <div className="text-sm">{formatKwh(contract.initialImportIndex)}</div>
      </Field>
      {contract.hasExports && (
        <Field>
          <FieldLabel>Opening export index</FieldLabel>
          <div className="text-sm">{formatKwh(contract.initialExportIndex)}</div>
        </Field>
      )}
      <FieldDescription>
        These were set when the meter was registered and can&apos;t be changed here.
      </FieldDescription>

      <PastBillsSection />

      <div className="flex flex-col gap-2 border-t pt-4">
        <FieldLabel className="text-destructive">Danger zone</FieldLabel>
        {!confirming ? (
          <Button type="button" variant="destructive" size="sm" className="w-fit" onClick={() => setConfirming(true)}>
            Deactivate meter
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">
              This stops tracking readings for this meter. History is kept, not deleted.
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="destructive" size="sm" disabled={isDeactivating} onClick={handleDeactivate}>
                {isDeactivating ? "Deactivating..." : "Confirm deactivate"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isDeactivating}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAppData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Profile, rate plan, solar export, and billing period.</CardDescription>
        {user && (
          <div className="text-sm text-muted-foreground">{user.firstName} {user.lastName} - {user.email}</div>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="tariff">Tariff &amp; Tiers</TabsTrigger>
            <TabsTrigger value="solar">Solar &amp; Export</TabsTrigger>
            <TabsTrigger value="billing">Billing Period</TabsTrigger>
            <TabsTrigger value="meter">Meter</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="tariff">
            <TariffTab />
          </TabsContent>
          <TabsContent value="solar">
            <SolarTab />
          </TabsContent>
          <TabsContent value="billing">
            <BillingTab />
          </TabsContent>
          <TabsContent value="meter">
            <MeterTab />
           </TabsContent>
         </Tabs>
         {user && <LogoutButton />}
       </CardContent>
     </Card>
   );
}
