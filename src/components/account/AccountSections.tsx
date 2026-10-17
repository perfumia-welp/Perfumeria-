import type { ReactNode } from "react"
import { useI18n } from "@/i18n/i18nContext"
import { paths, productPath } from "@/router/paths"
import type { Product } from "@/types/catalog"
import AppLink from "../ui/AppLink"
import Icon from "../ui/Icon"
import TextLink from "../ui/TextLink"

const pad = (value: number) => String(value).padStart(2, "0")

/** A titled account section with an optional action on the heading row. */
export function AccountSection({
  id,
  title,
  action,
  className,
  children,
}: {
  id: string
  title: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={["account-section", className].filter(Boolean).join(" ")}
      aria-labelledby={`${id}-title`}
    >
      <div className="account-section__heading">
        {/* Focusable from script, so focus can return here after a form closes. */}
        <h3 id={`${id}-title`} tabIndex={-1}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Moves focus to a section's heading (after a form inside it closes). */
export function focusSectionHeading(id: string) {
  document.getElementById(`${id}-title`)?.focus()
}

/** Shown when a section's data is empty. */
export function AccountEmptyState({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action: ReactNode
}) {
  return (
    <div className="account-empty">
      <p className="account-empty__title">{title}</p>
      <p>{text}</p>
      {action}
    </div>
  )
}

/** While a section's data loads. */
export function AccountLoading() {
  const { t } = useI18n()
  return (
    <p className="account-loading" role="status">
      {t.account.loading}
    </p>
  )
}

/** A section's data could not be loaded; offers a retry. */
export function AccountLoadError({ onRetry }: { onRetry: () => void }) {
  const copy = useI18n().t.account.loadError
  return (
    <AccountEmptyState
      title={copy.title}
      text={copy.text}
      action={<AccountTextButton label={copy.retry} onClick={onRetry} />}
    />
  )
}

/** A text-link styled button (heading actions, retry, add). */
export function AccountTextButton({
  label,
  onClick,
  expanded,
}: {
  label: string
  onClick: () => void
  expanded?: boolean
}) {
  return (
    <button
      type="button"
      className="text-link"
      aria-expanded={expanded}
      onClick={onClick}
    >
      <span>{label}</span>
      <Icon name="arrow" />
    </button>
  )
}

export function ExploreLink() {
  const { t } = useI18n()
  return <TextLink link={{ label: t.account.explore, href: paths.products }} />
}

/** The real wishlist (this device), linking to each product page. */
export function WishlistPreview({ products }: { products: Product[] }) {
  const count = products.length
  const copy = useI18n().t.account.wishlist
  return (
    <AccountSection
      id="account-wishlist"
      title={copy.title}
      className="account-section--paired"
      action={
        count > 0 && (
          <span className="account-section__count" aria-hidden="true">
            {pad(count)}
          </span>
        )
      }
    >
      {count ? (
        <>
          <p className="account-section__meta">{copy.count(count)}</p>
          <ul className="wishlist-preview">
            {products.slice(0, 3).map((product) => (
              <li key={product.id}>
                <AppLink href={productPath(product.slug)}>
                  <img src={product.packshot.src} alt="" loading="lazy" />
                  <span className="visually-hidden">{product.name}</span>
                </AppLink>
              </li>
            ))}
          </ul>
          <TextLink link={{ label: copy.view, href: paths.accountWishlist }} />
        </>
      ) : (
        <AccountEmptyState
          title={copy.emptyTitle}
          text={copy.emptyText}
          action={<ExploreLink />}
        />
      )}
    </AccountSection>
  )
}

/** Save / Cancel row with the form's status message. */
export function FormActions({
  statusId,
  submitting,
  submitLabel,
  statusText,
  isError,
  onCancel,
}: {
  statusId: string
  submitting: boolean
  submitLabel: string
  statusText: string
  isError: boolean
  onCancel: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="account-form__actions">
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? t.account.saving : submitLabel}
      </button>
      <button type="button" className="account-action" onClick={onCancel}>
        {t.account.cancel}
      </button>
      <p
        id={statusId}
        className={`account-status${isError ? " is-error" : ""}`}
        role="status"
      >
        {statusText}
      </p>
    </div>
  )
}
