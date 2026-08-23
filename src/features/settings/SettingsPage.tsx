import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAppData } from "@/state/useAppData";
import { logout as logoutRequest, clearTokens } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TariffTiersField } from "./components/TariffTiersField";
import {
  billingSchema,
  profileSchema,
  solarSchema,
  tariffSchema,
  type BillingFormValues,
  type ProfileFormValues,
  type SolarFormValues,
  type TariffFormValues,
} from "./settingsSchema";

function LogoutButton() {
  const { isAuthenticated, setUser } = useAppData();
  const navigate = useNavigate();

  async function handleLogout() {
    if (!isAuthenticated) return;
    try {
      await logoutRequest();
    } catch {
      toast.error("Failed to reach the server; logging out locally");
    } finally {
      clearTokens();
      setUser(null);
      navigate("/login");
    }
  }

  return <Button variant="outline" onClick={handleLogout} className="w-full">Log out</Button>;
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

function TariffTab() {
  const { config, updateConfig } = useAppData();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TariffFormValues>({ resolver: zodResolver(tariffSchema), defaultValues: config.tariff });

  function onSubmit(values: TariffFormValues) {
    updateConfig({ tariff: values });
    toast.success("Tariff saved");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="planName">Plan name</FieldLabel>
        <Input id="planName" {...register("planName")} aria-invalid={!!errors.planName} />
        <FieldError errors={errors.planName ? [errors.planName] : undefined} />
      </Field>

      <TariffTiersField control={control} register={register} errors={errors} />

      <Field>
        <FieldLabel htmlFor="fixedServiceCharge">Fixed service charge ($/period)</FieldLabel>
        <Input
          id="fixedServiceCharge"
          type="number"
          step="0.01"
          {...register("fixedServiceCharge", { valueAsNumber: true })}
        />
        <FieldError errors={errors.fixedServiceCharge ? [errors.fixedServiceCharge] : undefined} />
      </Field>
      <Field>
        <FieldLabel htmlFor="taxRatePercent">Tax rate (%)</FieldLabel>
        <Input
          id="taxRatePercent"
          type="number"
          step="0.1"
          {...register("taxRatePercent", { valueAsNumber: true })}
        />
        <FieldError errors={errors.taxRatePercent ? [errors.taxRatePercent] : undefined} />
      </Field>

      <FieldDescription>
        Changing your rate plan recalculates all historical bills using the new rates.
      </FieldDescription>

      <Button type="submit" disabled={isSubmitting} className="w-fit">
        Save tariff
      </Button>
    </form>
  );
}

function SolarTab() {
  const { config, updateConfig } = useAppData();
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SolarFormValues>({ resolver: zodResolver(solarSchema), defaultValues: config.solar });
  const enabled = watch("enabled");

  function onSubmit(values: SolarFormValues) {
    updateConfig({ solar: values });
    toast.success("Solar settings saved");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4">
      <Field orientation="horizontal">
        <FieldLabel htmlFor="solar-enabled">Solar panels / export plan</FieldLabel>
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <Switch id="solar-enabled" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="exportCreditRatePerKwh">Export credit rate ($/kWh)</FieldLabel>
        <Input
          id="exportCreditRatePerKwh"
          type="number"
          step="0.01"
          disabled={!enabled}
          {...register("exportCreditRatePerKwh", { valueAsNumber: true })}
        />
        <FieldError errors={errors.exportCreditRatePerKwh ? [errors.exportCreditRatePerKwh] : undefined} />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="w-fit">
        Save solar settings
      </Button>
    </form>
  );
}

function BillingTab() {
  const { config, updateConfig } = useAppData();
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: { billingPeriodDays: config.billingPeriodDays },
  });

  function onSubmit(values: BillingFormValues) {
    updateConfig({ billingPeriodDays: values.billingPeriodDays });
    toast.success("Billing period saved");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="billingPeriodDays">Billing period length</FieldLabel>
        <Controller
          control={control}
          name="billingPeriodDays"
          render={({ field }) => (
            <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
              <SelectTrigger id="billingPeriodDays" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <FieldDescription>
        Changing the billing period regroups all historical readings into new period boundaries.
      </FieldDescription>
      <Button type="submit" disabled={isSubmitting} className="w-fit">
        Save billing period
      </Button>
    </form>
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
