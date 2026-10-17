import type { ContactFormValues, ServiceResult } from "@/types/commerce"

/*
 * Contact message adapter. No messaging API exists yet, so nothing is sent
 * and the result is always "unavailable". Connect the real endpoint here.
 */
export async function sendContactMessage(
  values: ContactFormValues,
): Promise<ServiceResult> {
  void values
  return { status: "unavailable" }
}
