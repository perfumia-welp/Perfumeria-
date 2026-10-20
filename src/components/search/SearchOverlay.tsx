import { useRef, useState, type FormEvent } from "react"
import { useNavigate } from "react-router"
import { useI18n } from "@/i18n/i18nContext"
import { productPath, productsWith } from "@/router/paths"
import { useCatalogState } from "@/hooks/useCatalogState"
import { searchProducts } from "@/services/catalog"
import ProductPrice from "../product/ProductPrice"
import AppLink from "../ui/AppLink"
import Container from "../ui/Container"
import Icon from "../ui/Icon"
import Sheet from "../ui/Sheet"
import TextLink from "../ui/TextLink"
import "./SearchOverlay.css"

/*
 * The field is a text input (inside a role="search" form) rather than
 * type="search": a native search input spends the first Escape on clearing
 * its text, so Escape would not close the overlay.
 */

/** Shorter terms show the popular searches instead of results. */
const MIN_QUERY_LENGTH = 2

/**
 * Search drawer opened from the header. Live results are genuine catalogue
 * matches only and open their product page; "View all results" opens the
 * filtered Products page.
 */
export default function SearchOverlay({
  id,
  open,
  onClose,
}: {
  id: string
  open: boolean
  onClose: () => void
}) {
  const [term, setTerm] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { t, locale, localize } = useI18n()
  const copy = t.search

  const trimmed = term.trim()
  const isSearching = trimmed.length >= MIN_QUERY_LENGTH
  // Live search covers every product, so it waits for the full catalogue.
  const catalog = useCatalogState()
  const result =
    isSearching && catalog.complete ? searchProducts(trimmed, locale) : null

  const handleClose = () => {
    setTerm("")
    onClose()
  }

  const status = !result
    ? isSearching
      ? copy.loading
      : ""
    : result.total
      ? copy.found(result.total)
      : copy.none

  return (
    <Sheet
      id={id}
      open={open}
      onClose={handleClose}
      label={copy.label}
      variant="top"
      className="search-overlay"
      initialFocus={inputRef}
      dismissOnBackdrop
    >
      {(close) => {
        const submit = (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          if (!trimmed) return
          close()
          navigate(localize(productsWith("q", trimmed)))
        }

        return (
          <Container className="search-overlay__inner">
            <div className="search-overlay__heading">
              <p className="eyebrow">{copy.label}</p>
              <button
                type="button"
                className="search-overlay__close"
                aria-label={copy.close}
                onClick={close}
              >
                <Icon name="close" />
              </button>
            </div>

            <form
              className="search-overlay__field"
              role="search"
              onSubmit={submit}
            >
              <label className="visually-hidden" htmlFor={`${id}-input`}>
                {copy.inputLabel}
              </label>
              <input
                ref={inputRef}
                id={`${id}-input`}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder={copy.placeholder}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
              />
              <button type="submit" aria-label={copy.submit}>
                <Icon name="search" />
              </button>
            </form>

            <p className="visually-hidden" role="status">
              {status}
            </p>

            {!result && (
              <div className="search-overlay__popular">
                <h2 className="search-overlay__label">{copy.popular}</h2>
                <ul>
                  {t.catalog.popularSearches.map((suggestion) => (
                    <li key={suggestion}>
                      <button type="button" onClick={() => setTerm(suggestion)}>
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result && result.total > 0 && (
              <div className="search-overlay__results">
                <h2 className="visually-hidden">{copy.results}</h2>
                <ul className="search-overlay__grid">
                  {result.items.map((product) => (
                    <li key={product.id}>
                      <AppLink
                        className="search-result"
                        href={productPath(product.slug)}
                        onClick={close}
                      >
                        <div className="search-result__image">
                          <img src={product.packshot.src} srcSet={product.packshot.srcSet} sizes="120px" alt="" />
                        </div>
                        <div className="search-result__text">
                          <span className="search-result__name">
                            {product.name}
                          </span>
                          <span className="search-result__notes">
                            {[
                              ...product.notes,
                              product.size &&
                                t.common.compactSize(product.size),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          <ProductPrice
                            product={product}
                            className="search-result__price"
                          />
                        </div>
                      </AppLink>
                    </li>
                  ))}
                </ul>
                <TextLink
                  link={{
                    label: copy.viewAll(trimmed),
                    href: productsWith("q", trimmed),
                  }}
                  onClick={close}
                />
              </div>
            )}

            {result && result.total === 0 && (
              <div className="search-overlay__empty">
                <h2>{copy.empty.title}</h2>
                <p>{copy.empty.text}</p>
              </div>
            )}
          </Container>
        )
      }}
    </Sheet>
  )
}
