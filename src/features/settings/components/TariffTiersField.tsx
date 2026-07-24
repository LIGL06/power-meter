import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import type { TariffFormValues } from "../settingsSchema";

interface TariffTiersFieldProps {
  control: Control<TariffFormValues>;
  register: UseFormRegister<TariffFormValues>;
  errors: FieldErrors<TariffFormValues>;
}

/** Price brackets for a tiered rate plan. The last row is always the unbounded tier — "Add" inserts before it, never after. */
export function TariffTiersField({ control, register, errors }: TariffTiersFieldProps) {
  const { fields, insert, remove } = useFieldArray({ control, name: "tiers" });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <FieldLabel>Rate tiers</FieldLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => insert(fields.length - 1, { upToKwh: 0, ratePerKwh: 0 })}
        >
          <Plus /> Add tier
        </Button>
      </div>

      {fields.map((field, index) => {
        const isLast = index === fields.length - 1;
        return (
          <div key={field.id} className="flex items-end gap-2">
            <Field className="flex-1">
              <FieldLabel htmlFor={`tiers.${index}.upToKwh`}>Up to (kWh)</FieldLabel>
              {isLast ? (
                <Input id={`tiers.${index}.upToKwh`} value="Unlimited" disabled readOnly />
              ) : (
                <Input
                  id={`tiers.${index}.upToKwh`}
                  type="number"
                  step="1"
                  {...register(`tiers.${index}.upToKwh`, { valueAsNumber: true })}
                />
              )}
            </Field>
            <Field className="flex-1">
              <FieldLabel htmlFor={`tiers.${index}.ratePerKwh`}>Rate ($/kWh)</FieldLabel>
              <Input
                id={`tiers.${index}.ratePerKwh`}
                type="number"
                step="0.01"
                {...register(`tiers.${index}.ratePerKwh`, { valueAsNumber: true })}
              />
            </Field>
            {!isLast && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove tier"
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        );
      })}

      <FieldError errors={errors.tiers?.root ? [errors.tiers.root] : undefined} />
    </div>
  );
}
