import { useI18n } from "@/i18n/i18nContext"
import AppLink from "../ui/AppLink"
import Icon from "../ui/Icon"
import { pageWindow, type Slot } from "./pageWindow"
import "./Pagination.css"

const pad = (value: number) => String(value).padStart(2, "0")

/**
 * Page links for the product listing; every page is a shareable URL.
 * Desktop shows a window of pages (current ±1), tablet current only, phones
 * a compact "Page 8 of 31" between the arrows. Renders nothing for one page.
 */
export default function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number
  pageCount: number
  hrefFor: (page: number) => string
}) {
  const copy = useI18n().t.products.pagination
  if (pageCount <= 1) return null

  const pages = (slots: Slot[], variant: "wide" | "narrow") => (
    <ol className={`pagination__pages pagination__pages--${variant}`}>
      {slots.map((slot, index) =>
        slot === "gap" ? (
          <li key={`gap-${index}`} className="pagination__gap" aria-hidden="true">
            …
          </li>
        ) : (
          <li key={slot}>
            <AppLink
              href={hrefFor(slot)}
              aria-label={copy.page(slot)}
              aria-current={slot === page ? "page" : undefined}
            >
              {pad(slot)}
            </AppLink>
          </li>
        ),
      )}
    </ol>
  )

  const step = (direction: "previous" | "next") => {
    const target = direction === "previous" ? page - 1 : page + 1
    const content = (
      <>
        {direction === "next" && <span className="pagination__step-label">{copy.next}</span>}
        <Icon name="arrow" />
        {direction === "previous" && (
          <span className="pagination__step-label">{copy.previous}</span>
        )}
      </>
    )
    const className = `pagination__step pagination__step--${direction}`
    return target >= 1 && target <= pageCount ? (
      <AppLink
        className={className}
        href={hrefFor(target)}
        aria-label={`${copy[direction]}: ${copy.page(target)}`}
      >
        {content}
      </AppLink>
    ) : (
      <span className={`${className} is-disabled`} aria-disabled="true">
        {content}
      </span>
    )
  }

  return (
    <nav className="pagination" aria-label={copy.label}>
      {step("previous")}
      <div className="pagination__middle">
        {pages(pageWindow(page, pageCount, 1), "wide")}
        {pages(pageWindow(page, pageCount, 0), "narrow")}
        <p className="pagination__status">{copy.pageOf(page, pageCount)}</p>
      </div>
      {step("next")}
    </nav>
  )
}
