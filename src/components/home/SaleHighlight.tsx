import { useHighestSale } from "@/hooks/useHighestSale"
import { useI18n } from "@/i18n/i18nContext"
import { paths } from "@/router/paths"
import AppLink from "../ui/AppLink"
import Container from "../ui/Container"
import Icon from "../ui/Icon"
import "./SaleHighlight.css"

/*
 * Mid-page sale highlight: "Up to X% Off", where X is the highest discount a
 * product card shows in the live catalogue right now (useHighestSale), never
 * a fixed figure. While that is still being worked out the panel holds its
 * place with its content hidden and no figure at all; with no genuine sale
 * (or the mock catalogue, or a failed load) it is left out.
 *
 * The products page has no sale filter, so the call to action opens the
 * full collection, where every discounted card shows its own sale.
 */
export default function SaleHighlight() {
  const { t } = useI18n()
  const copy = t.home.saleHighlight
  const sale = useHighestSale()
  if (sale.status === "none") return null
  const pending = sale.status === "pending"

  return (
    <Container
      as="section"
      className="sale-highlight"
      aria-labelledby={pending ? undefined : "sale-highlight-title"}
      aria-busy={pending || undefined}
    >
      <div
        className={`sale-highlight__panel${pending ? " is-pending" : ""}`}
        aria-hidden={pending || undefined}
      >
        <h2 id="sale-highlight-title" className="sale-highlight__title">
          <span className="sale-highlight__lead">{copy.lead}</span>{" "}
          <span className="sale-highlight__amount">
            <span className="sale-highlight__figure">
              {!pending && <bdi dir="ltr">{copy.figure(sale.percentage)}</bdi>}
            </span>
            {copy.trail && (
              <>
                {" "}
                <span className="sale-highlight__trail">{copy.trail}</span>
              </>
            )}
          </span>
        </h2>
        <div className="sale-highlight__copy">
          <p className="sale-highlight__description">{copy.description}</p>
          <AppLink
            className="button-primary sale-highlight__cta"
            href={paths.products}
            tabIndex={pending ? -1 : undefined}
          >
            <span>{copy.cta}</span>
            <Icon name="arrow" />
          </AppLink>
        </div>
      </div>
    </Container>
  )
}
