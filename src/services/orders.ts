import { FunctionsHttpError } from "@supabase/supabase-js"
import { company } from "@/config/company"
import { getMessages } from "@/i18n/messages"
import { orderEmailContent } from "@/lib/orderRequest"
import { loadSupabase } from "@/lib/supabase"
import type { ServiceResult } from "@/types/commerce"
import type { OrderRequest } from "@/types/order"

/*
 * Order-request adapter. Today it only emails the request to the store
 * through the send-order-request Edge Function (Resend). The Resend key and
 * the store inbox live in that function's secrets, never in the browser.
 * Later this is where the order is also saved to Supabase.
 *
 * Results: "success" = the function accepted and sent the email;
 * "unavailable" = email delivery is not set up yet; "error" = it failed.
 */

const EMAIL_TIMEOUT_MS = 15000

/**
 * Saves a signed-in customer's order request to their account history
 * (Account → Orders) through the create_order_request database function,
 * which stores the order and its items in one transaction and always owns
 * it by the session user. Sending the same reference again (an edited
 * resubmit) updates that record instead of adding one. Guests are never saved. A failure is only logged:
 * it must never interrupt checkout or WhatsApp. This history is a record
 * for the customer, not the store's fulfilment system.
 */
export async function saveOrderToHistory(order: OrderRequest) {
  try {
    const supabase = await loadSupabase()
    if (!supabase) return
    const { error } = await supabase.rpc("create_order_request", {
      request: {
        reference: order.reference,
        locale: order.locale,
        customer_name: order.customer.fullName,
        phone: order.customer.phone,
        email: order.customer.email,
        delivery_address: order.delivery.address,
        city_area: order.delivery.cityArea,
        notes: order.notes ?? "",
        is_gift: Boolean(order.gift),
        gift_message: order.gift?.message ?? "",
        promo_code: order.promo?.code ?? "",
        currency: order.currency,
        items: order.lines.map((line) => ({
          product_ref: line.productId,
          product_name: line.name,
          size: line.size ?? "",
          quantity: line.quantity,
          unit_price: line.unitPrice,
          image_url: line.imageUrl ?? "",
        })),
      },
    })
    if (error)
      console.error("Saving the order to account history failed", error)
  } catch (error) {
    console.error("Saving the order to account history failed", error)
  }
}

export async function sendOrderRequestEmail(
  order: OrderRequest,
): Promise<ServiceResult> {
  if (!company.orderEmailEnabled) return { status: "unavailable" }
  const supabase = await loadSupabase()
  if (!supabase) return { status: "unavailable" }

  try {
    // The email is written in the checkout language by the shared generator.
    const message = orderEmailContent(
      order,
      getMessages(order.locale).checkout.orderMessage,
    )
    const { error } = await supabase.functions.invoke("send-order-request", {
      body: { ...order, message },
      timeout: EMAIL_TIMEOUT_MS,
    })
    if (!error) return { status: "success" }

    // 404: function not deployed; 503: deployed without its secrets.
    if (
      error instanceof FunctionsHttpError &&
      [404, 503].includes((error.context as Response).status)
    ) {
      return { status: "unavailable" }
    }
    console.error("send-order-request failed", error)
    return { status: "error", message: "The email could not be sent." }
  } catch (error) {
    console.error("send-order-request failed", error)
    return { status: "error", message: "The email could not be sent." }
  }
}
