import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAppData } from "@/state/useAppData";
import { useLogout } from "@/state/useLogout";
import type { PeriodLength, ServiceAddress, TariffDto } from "@/domain/types";
import { getErrorMessage } from "@/lib/api";
import { contractRepository, tariffRepository, usersRepository } from "@/data/repositories/api";
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
import { profileSchema, type ProfileFormValues } from "./settingsSchema";

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
    <div className="flex max-w-md flex-col gap-4">
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
