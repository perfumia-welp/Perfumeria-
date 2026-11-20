import type { useValidatedForm } from "@/hooks/useValidatedForm"
import { useI18n } from "@/i18n/i18nContext"
import { asciiDigits, type OrderDetailsField } from "@/lib/orderDetails"
import FormField from "../ui/FormField"

interface OrderDetailsFieldsProps {
  form: ReturnType<typeof useValidatedForm<OrderDetailsField>>
}

/**
 * Contact and delivery fields, shared by Checkout and the order edit form.
 * Required labels carry a quiet "*"; Order Notes says "Optional".
 */
export default function OrderDetailsFields({ form }: OrderDetailsFieldsProps) {
  const copy = useI18n().t.checkout
  const phone = form.fieldProps("phone")
  return (
    <>
      <fieldset>
        <legend>{copy.legends.details}</legend>
        <FormField
          markRequired
          label={copy.fields.fullName}
          placeholder={copy.placeholders.fullName}
          autoComplete="name"
          autoCapitalize="words"
          maxLength={120}
          className="checkout-form__wide"
          {...form.fieldProps("fullName")}
        />
        <FormField
          markRequired
          label={copy.fields.phone}
          placeholder={copy.placeholders.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={40}
          {...phone}
          onChange={(event) =>
            phone.onChange({
              target: { value: asciiDigits(event.target.value) },
            })
          }
        />
        <FormField
          markRequired
          label={copy.fields.email}
          placeholder={copy.placeholders.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={160}
          {...form.fieldProps("email")}
        />
      </fieldset>

      {/* City first, then the street: the order an address is
          usually given in Egypt, and the order the store reads it. */}
      <fieldset>
        <legend>{copy.legends.delivery}</legend>
        <FormField
          markRequired
          label={copy.fields.cityArea}
          placeholder={copy.placeholders.cityArea}
          autoComplete="address-level2"
          maxLength={120}
          className="checkout-form__wide"
          {...form.fieldProps("cityArea")}
        />
        <FormField
          markRequired
          label={copy.fields.address}
          placeholder={copy.placeholders.address}
          autoComplete="street-address"
          maxLength={300}
          className="checkout-form__wide"
          {...form.fieldProps("address")}
        />
        <FormField
          label={copy.fields.notes}
          placeholder={copy.placeholders.notes}
          multiline
          optional
          rows={3}
          maxLength={1000}
          className="checkout-form__wide"
          {...form.fieldProps("notes")}
        />
      </fieldset>
    </>
  )
}
