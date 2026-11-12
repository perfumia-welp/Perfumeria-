import type { MouseEvent } from "react"
import { useI18n } from "@/i18n/i18nContext"
import "./LoadMore.css"

/**
 * Under the product grid: how many products are shown, and a View More
 * button that reveals the next batch below them (never reorders, never
 * scrolls). The button goes once everything is shown.
 */
export default function LoadMore({
  shown,
  total,
  onMore,
}: {
  shown: number
  total: number
  onMore: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  const copy = useI18n().t.products.loadMore
  if (total <= 0) return null

  return (
    <div className="load-more">
      <p className="load-more__status">{copy.shown(shown, total)}</p>
      {shown < total && (
        <button
          type="button"
          className="button-primary load-more__button"
          onClick={onMore}
        >
          {copy.action}
        </button>
      )}
    </div>
  )
}
