import { optionGroupId, type ProductOptionsState } from "@/hooks/useProductOptions"
import { useI18n } from "@/i18n/i18nContext"
import { formatPrice } from "@/lib/formatPrice"
import { localizeText } from "@/services/catalog"

/**
 * The company's product choices (today: with box / without box) on the
 * product page. Uses the existing size-row styles; not a redesign.
 *
 * A required choice says so quietly under its options ("Choose an option")
 * from the start. If Add to Bag is pressed without it, that line becomes the
 * error for that group, announced and linked to its options, until a choice
 * is made. The message names no company field: their labels are raw.
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
      {state.variations.map((variation) => {
        const groupId = optionGroupId(variation.id)
        const messageId = `${groupId}-message`
        const needed = state.missing.includes(variation.id)
        const invalid = state.required && needed
        // Guidance until picked; afterwards its line stays, empty, so nothing below moves.
        const guided = variation.required || invalid
        return (
          <fieldset
            key={variation.id}
            id={groupId}
            className={`pdp__option pdp__option--choice${invalid ? " is-invalid" : ""}`}
            aria-describedby={guided && needed ? messageId : undefined}
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
                    aria-invalid={invalid || undefined}
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
            {guided &&
              (invalid ? (
                // A new element (key) so the error is announced as it appears.
                <p
                  key="error"
                  id={messageId}
                  className="pdp__option-message pdp__option-message--error"
                  role="alert"
                >
                  {copy.required}
                </p>
              ) : (
                <p
                  key="hint"
                  id={messageId}
                  className={`pdp__option-message${needed ? "" : " is-settled"}`}
                >
                  {copy.hint}
                </p>
              ))}
          </fieldset>
        )
      })}
    </>
  )
}
