import type { ProductOptionsState } from "@/hooks/useProductOptions"
import { useI18n } from "@/i18n/i18nContext"
import { formatPrice } from "@/lib/formatPrice"
import { localizeText } from "@/services/catalog"

/**
 * The company's product choices (today: with box / without box) on the
 * product page. Uses the existing size-row styles; not a redesign.
 */
export default function ProductOptions({ state }: { state: ProductOptionsState }) {
  const { t, locale } = useI18n()
  const copy = t.product.options

  if (state.status === "loading")
    return (
      <p className="pdp__option pdp__label" role="status">
        {copy.loading}
      </p>
    )
  if (state.status === "error")
    return (
      <div className="pdp__option" role="alert">
        <span className="pdp__label">{copy.error}</span>
        <button
          type="button"
          className="pdp__size pdp__retry"
          onClick={state.retry}
        >
          <span>{copy.retry}</span>
        </button>
      </div>
    )

  return (
    <>
      {state.variations.map((variation) => (
        <fieldset
          key={variation.id}
          className="pdp__option"
          aria-describedby={state.required ? "pdp-option-required" : undefined}
        >
          <legend className="pdp__label">
            {localizeText(variation.name, locale)}
          </legend>
          <div className="pdp__sizes">
            {variation.options.map((option) => (
              <label key={option.id} className="pdp__size">
                <input
                  type="radio"
                  name={`pdp-option-${variation.id}`}
                  value={option.id}
                  checked={state.picks[variation.id] === option.id}
                  required={variation.required}
                  data-product-option=""
                  onChange={() => state.pick(variation.id, option.id)}
                />
                <span>
                  {localizeText(option.name, locale)}
                  {variation.replacesPrice && option.price !== undefined
                    ? ` · ${formatPrice(option.price, state.product.currency, locale)}`
                    : ""}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {state.required && (
        <p
          id="pdp-option-required"
          className="pdp__availability is-unavailable"
          role="alert"
        >
          {copy.required}
        </p>
      )}
    </>
  )
}
