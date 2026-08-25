import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/api";
import { contractRepository } from "@/data/repositories/api";
import { useAppData } from "@/state/useAppData";
import { todayISO } from "@/domain/date-utils";
import { addMeterSchema, type AddMeterFormValues } from "./addMeterSchema";

const DEFAULT_VALUES: AddMeterFormValues = {
  alias: "",
  serviceNumber: "",
  meterSerial: "",
  customerType: "RESIDENTIAL",
  tariffCode: "1C",
  periodDays: 60,
  billingAnchorDate: new Date().toISOString().slice(0, 10),
  hasExports: false,
  initialImportIndex: 0,
  initialExportIndex: 0,
};

export function AddMeterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { setContract } = useAppData();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddMeterFormValues>({ resolver: zodResolver(addMeterSchema), defaultValues: DEFAULT_VALUES });
  const hasExports = watch("hasExports");
  const billingAnchorDate = watch("billingAnchorDate");
  const today = todayISO();
  const isBackdated = billingAnchorDate !== today;

  async function onSubmit(values: AddMeterFormValues) {
    setIsSubmitting(true);
    try {
      const contract = await contractRepository.create({
        ...values,
        meterSerial: values.meterSerial || undefined,
        billingAnchorDate: new Date(values.billingAnchorDate).toISOString(),
      });
      setContract(contract);
      toast.success("Meter added");
      navigate("/");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Add your meter</CardTitle>
          <CardDescription>Register your CFE service contract to start tracking readings.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="alias">Alias</FieldLabel>
              <Input id="alias" placeholder="Casa" {...register("alias")} aria-invalid={!!errors.alias} />
              <FieldError errors={errors.alias ? [errors.alias] : undefined} />
            </Field>

            <Field>
              <FieldLabel htmlFor="serviceNumber">Service number (RPU)</FieldLabel>
              <Input id="serviceNumber" {...register("serviceNumber")} aria-invalid={!!errors.serviceNumber} />
              <FieldError errors={errors.serviceNumber ? [errors.serviceNumber] : undefined} />
            </Field>

            <Field>
              <FieldLabel htmlFor="meterSerial">Meter serial (optional)</FieldLabel>
              <Input id="meterSerial" {...register("meterSerial")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="customerType">Customer type</FieldLabel>
              <Controller
                control={control}
                name="customerType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="customerType" className="w-full">
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
              <FieldLabel htmlFor="tariffCode">Tariff code</FieldLabel>
              <Input id="tariffCode" {...register("tariffCode")} aria-invalid={!!errors.tariffCode} />
              <FieldError errors={errors.tariffCode ? [errors.tariffCode] : undefined} />
            </Field>

            <Field>
              <FieldLabel htmlFor="periodDays">Billing period length</FieldLabel>
              <Controller
                control={control}
                name="periodDays"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                    <SelectTrigger id="periodDays" className="w-full">
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

            <Field>
              <FieldLabel htmlFor="billingAnchorDate">First billing period starts</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id="billingAnchorDate"
                  type="date"
                  className="flex-1"
                  {...register("billingAnchorDate")}
                  aria-invalid={!!errors.billingAnchorDate}
                />
                {isBackdated && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setValue("billingAnchorDate", today, { shouldValidate: true })}
                  >
                    Use today
                  </Button>
                )}
              </div>
              <FieldError errors={errors.billingAnchorDate ? [errors.billingAnchorDate] : undefined} />
              {isBackdated && (
                <FieldDescription className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-amber-700 dark:text-amber-400">
                  This date can&apos;t be changed later. Backdating only works if the opening index you enter below
                  is the meter&apos;s <em>real</em> reading on this exact date — not an estimate. Not sure? Use
                  today&apos;s date with today&apos;s actual reading instead; the app just won&apos;t line up with
                  your CFE cycle boundary.
                </FieldDescription>
              )}
            </Field>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="hasExports">Solar panels / export register</FieldLabel>
              <Controller
                control={control}
                name="hasExports"
                render={({ field }) => (
                  <Switch id="hasExports" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="initialImportIndex">
                Meter&apos;s exact import reading on the start date above
              </FieldLabel>
              <Input
                id="initialImportIndex"
                type="number"
                step="1"
                {...register("initialImportIndex", { valueAsNumber: true })}
                aria-invalid={!!errors.initialImportIndex}
              />
              <FieldError errors={errors.initialImportIndex ? [errors.initialImportIndex] : undefined} />
            </Field>

            {hasExports && (
              <Field>
                <FieldLabel htmlFor="initialExportIndex">
                  Meter&apos;s exact export reading on the start date above
                </FieldLabel>
                <Input
                  id="initialExportIndex"
                  type="number"
                  step="1"
                  {...register("initialExportIndex", { valueAsNumber: true })}
                  aria-invalid={!!errors.initialExportIndex}
                />
                <FieldError errors={errors.initialExportIndex ? [errors.initialExportIndex] : undefined} />
              </Field>
            )}

            <FieldDescription>
              The service number, start date, and opening meter index can't be changed later.
            </FieldDescription>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Adding meter..." : "Add meter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
