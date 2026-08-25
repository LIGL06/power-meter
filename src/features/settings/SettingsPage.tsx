import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAppData } from "@/state/useAppData";
import { useLogout } from "@/state/useLogout";
import type { PeriodLength, TariffDto } from "@/domain/types";
import { getErrorMessage } from "@/lib/api";
import { contractRepository, tariffRepository } from "@/data/repositories/api";
import { formatCurrency, formatKwh } from "@/lib/format";
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
  const { config, updateConfig } = useAppData();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema), defaultValues: config.profile });

  function onSubmit(values: ProfileFormValues) {
    updateConfig({ profile: values });
    toast.success("Profile saved");
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
        <FieldLabel htmlFor="address">Address</FieldLabel>
        <Input id="address" {...register("address")} aria-invalid={!!errors.address} />
        <FieldError errors={errors.address ? [errors.address] : undefined} />
      </Field>
      <Field>
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <Input id="password" type="password" {...register("password")} aria-invalid={!!errors.password} />
        <FieldError errors={errors.password ? [errors.password] : undefined} />
      </Field>
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
         </Tabs>
         {user && <LogoutButton />}
       </CardContent>
     </Card>
   );
}
