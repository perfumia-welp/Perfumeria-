import type { Product } from "@/types/catalog"
import type { CartItem } from "@/types/commerce"
import type { OrderRequest } from "@/types/order"
import {
  metaAmount,
  metaContentId,
  onceMeta,
  trackMetaEvent,
  type MetaContent,
} from "./metaPixel"

/*
 * The Meta events of the Perfumira journey (see lib/metaPixel.ts):
 *
 *   PageView          every page, initial load and each route change
 *   ViewContent       a product page is shown
 *   AddToCart         Add to Bag succeeded (a line was added or increased)
 *   InitiateCheckout  the Checkout form is shown with the bag
 *   Lead              an order REQUEST was stored by the server
 *
 * Why Lead and not Purchase: placing an order on this site stores a request
 * that the team then confirms with the customer (WhatsApp / email); nothing
 * is paid on the site (payment is null on every order). Purchase tells Meta
 * that revenue was collected, which would overstate sales and train ads on
 * requests that may never be confirmed or paid. Lead is Meta's standard
 * event for "submitted their details to be contacted", which is exactly
 * what an order request is. Its value is the request's value (after the Buy
 * 3, Get the 4th Free promotion), reported as a lead value, not revenue.
 * Purchase should only be sent once an order is confirmed or paid, ideally
 * from the server (Conversions API) using the order reference as event id.
 *
 * Product ids are Welp product ids, so a Meta catalogue made from the same
 * feed would match. Every value is in the catalogue's currency (EGP).
 * No names, emails, phones or addresses of customers are ever included.
 */

const content = (product: Product, quantity: number): MetaContent => ({
  id: metaContentId(product),
  quantity,
  item_price: metaAmount(product.price),
})

const category = (product: Product) =>
  product.giftSet ? "Perfume Set" : product.gender ? `${product.gender} perfume` : undefined

/** ViewContent, once per visit to a product page (`visitKey` = router location key). */
export function metaViewContent(product: Product, price: number, visitKey: string) {
  const id = metaContentId(product)
  onceMeta(`view:${visitKey}:${id}`, () =>
    trackMetaEvent("ViewContent", {
      content_ids: [id],
      content_type: "product",
      content_name: product.translations?.name.en ?? product.name,
      content_category: category(product),
      contents: [{ id, quantity: 1, item_price: metaAmount(price) }],
      currency: product.currency,
      value: metaAmount(price),
    }),
  )
}

/** AddToCart: called once per successful Add to Bag (BagProvider.addItem). */
export function metaAddToCart(product: Product, quantity: number) {
  trackMetaEvent("AddToCart", {
    content_ids: [metaContentId(product)],
    content_type: "product",
    content_name: product.translations?.name.en ?? product.name,
    content_category: category(product),
    contents: [content(product, quantity)],
    currency: product.currency,
    value: metaAmount(product.price * quantity),
  })
}

/** InitiateCheckout, once per visit to Checkout (`visitKey` = router location key). */
export function metaInitiateCheckout(items: CartItem[], total: number, visitKey: string) {
  if (!items.length) return
  onceMeta(`checkout:${visitKey}`, () =>
    trackMetaEvent("InitiateCheckout", {
      content_ids: [...new Set(items.map(({ product }) => metaContentId(product)))],
      content_type: "product",
      contents: items.map(({ product, quantity }) => content(product, quantity)),
      num_items: items.reduce((sum, { quantity }) => sum + quantity, 0),
      currency: items[0].product.currency,
      value: metaAmount(total),
    }),
  )
}

/**
 * Lead for an order request the server stored. Once per order reference in
 * this tab, so a repeat of the same request (double submit, reload) is not
 * a second lead; the reference is also Meta's event id for deduplication.
 */
export function metaOrderRequest(order: OrderRequest) {
  onceMeta(
    `lead:${order.reference}`,
    () => {
      const contents = order.lines.map((line) => ({
        id: line.welpProductId !== undefined ? String(line.welpProductId) : line.productId.split("~")[0],
        quantity: line.quantity,
        item_price: metaAmount(line.unitPrice),
      }))
      trackMetaEvent(
        "Lead",
        {
          content_ids: [...new Set(contents.map((item) => item.id))],
          content_type: "product",
          content_category: "order_request",
          contents,
          num_items: order.lines.reduce((sum, line) => sum + line.quantity, 0),
          currency: order.currency,
          value: metaAmount(order.displayedTotal),
        },
        order.reference,
      )
    },
    true,
  )
}
