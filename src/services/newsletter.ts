/*
 * Newsletter subscription adapter.
 *
 * No subscription API exists yet, so nothing is sent and the result is always
 * "unavailable". Connect the real endpoint here; the form already handles the
 * "subscribed" and "error" outcomes.
 */

interface SubscribedResult {
  status: "subscribed"
}

interface UnavailableResult {
  status: "unavailable"
}

interface ErrorResult {
  status: "error"
  message: string
}

export type NewsletterResult = SubscribedResult | UnavailableResult | ErrorResult

export async function subscribeToNewsletter(
  email: string,
): Promise<NewsletterResult> {
  void email
  return { status: "unavailable" }
}
