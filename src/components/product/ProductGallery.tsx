import { useState } from "react"
import { useI18n } from "@/i18n/i18nContext"
import type { Product } from "@/types/catalog"
import "./ProductCard.css"

/**
 * Product-page imagery: the packshot on the catalogue's neutral stage, then
 * the editorial photograph where one exists. Thumbnails appear only when
 * there is more than one image.
 */
export default function ProductGallery({ product }: { product: Product }) {
  const [active, setActive] = useState(0)
  const copy = useI18n().t.product.gallery
  const views = [
    { key: "packshot", label: copy.bottle, image: product.packshot },
    ...(product.image
      ? [{ key: "editorial", label: copy.photograph, image: product.image }]
      : []),
    ...(product.gallery ?? []).map((image, index) => ({
      key: `gallery-${index}`,
      label: image.alt || copy.photograph,
      image,
    })),
  ]
  const current = views[active] ?? views[0]

  return (
    <div className="pdp-gallery">
      <div className="pdp-gallery__frame">
        {current.key === "packshot" ? (
          <div
            className={`product-card__stage pdp-gallery__stage${product.packshotStyle === "photo" ? " product-card__stage--photo" : ""}`}
          >
            <img
              src={product.packshot.src}
              srcSet={product.packshot.srcSet}
              sizes="(max-width: 1023px) 100vw, 58vw"
              alt={product.packshot.alt}
              decoding="async"
            />
          </div>
        ) : (
          <div className="pdp-gallery__photo">
            <img
              src={current.image.src}
              srcSet={current.image.srcSet}
              sizes="(max-width: 1023px) 100vw, 58vw"
              alt={current.image.alt}
              decoding="async"
            />
          </div>
        )}
      </div>

      {views.length > 1 && (
        <ul className="pdp-gallery__thumbs" aria-label={copy.label}>
          {views.map((view, index) => {
            const image = view.image
            return (
              <li key={view.key}>
                <button
                  type="button"
                  className={
                    view.key === "packshot" ? "is-packshot" : undefined
                  }
                  aria-label={copy.show(index + 1, views.length, view.label)}
                  aria-pressed={index === active}
                  onClick={() => setActive(index)}
                >
                  <img src={image.src} srcSet={image.srcSet} sizes="120px" alt="" loading="lazy" decoding="async" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
