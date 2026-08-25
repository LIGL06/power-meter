import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import type { AdminTariffFormValues } from "../adminTariffSchema";

interface SeasonTiersFieldProps {
  control: Control<AdminTariffFormValues>;
  register: UseFormRegister<AdminTariffFormValues>;
  errors: FieldErrors<AdminTariffFormValues>;
  seasonIndex: 0 | 1;
}

/** Price brackets for one season. The last row is always the unbounded tier — "Add" inserts before it, never after. */
export function SeasonTiersField({ control, register, errors, seasonIndex }: SeasonTiersFieldProps) {
  const { fields, insert, remove } = useFieldArray({ control, name: `seasons.${seasonIndex}.tiers` });
  const seasonErrors = errors.seasons?.[seasonIndex];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <FieldLabel>Tiers</FieldLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => insert(fields.length - 1, { name: "", upToKwhPer30Days: 0, pricePerKwh: 0 })}
        >
          <Plus /> Add tier
        </Button>
      </div>

      {fields.map((field, index) => {
        const isLast = index === fields.length - 1;
        const tierErrors = seasonErrors?.tiers?.[index];
        return (
          <div key={field.id} className="flex flex-col gap-1">
            <div className="flex items-end gap-2">
              <Field className="flex-1">
                <FieldLabel htmlFor={`seasons.${seasonIndex}.tiers.${index}.name`}>Name</FieldLabel>
                <Input
                  id={`seasons.${seasonIndex}.tiers.${index}.name`}
                  {...register(`seasons.${seasonIndex}.tiers.${index}.name`)}
                  aria-invalid={!!tierErrors?.name}
                />
              </Field>
              <Field className="flex-1">
                <FieldLabel htmlFor={`seasons.${seasonIndex}.tiers.${index}.upToKwhPer30Days`}>
                  Up to (kWh/30d)
                </FieldLabel>
                {isLast ? (
                  <Input value="Unlimited" disabled readOnly />
                ) : (
                  <Input
                    id={`seasons.${seasonIndex}.tiers.${index}.upToKwhPer30Days`}
                    type="number"
                    step="1"
                    {...register(`seasons.${seasonIndex}.tiers.${index}.upToKwhPer30Days`, { valueAsNumber: true })}
                    aria-invalid={!!tierErrors?.upToKwhPer30Days}
                  />
                )}
              </Field>
              <Field className="flex-1">
                <FieldLabel htmlFor={`seasons.${seasonIndex}.tiers.${index}.pricePerKwh`}>Price ($/kWh)</FieldLabel>
                <Input
                  id={`seasons.${seasonIndex}.tiers.${index}.pricePerKwh`}
                  type="number"
                  step="0.001"
                  {...register(`seasons.${seasonIndex}.tiers.${index}.pricePerKwh`, { valueAsNumber: true })}
                  aria-invalid={!!tierErrors?.pricePerKwh}
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
            <FieldError
              errors={[tierErrors?.name, tierErrors?.upToKwhPer30Days, tierErrors?.pricePerKwh].filter(Boolean)}
            />
          </div>
        );
      })}

      <FieldError errors={seasonErrors?.tiers?.root ? [seasonErrors.tiers.root] : undefined} />
    </div>
  );
}
