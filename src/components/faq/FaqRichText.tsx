import type { FaqRichText as FaqRichTextValue } from "@/data/faq"
import AppLink from "../ui/AppLink"
import "./FaqRichText.css"

/** Owner copy with its inline links, navigated client-side by AppLink. */
export default function FaqRichText({ text }: { text: FaqRichTextValue }) {
  return text.map((part, index) =>
    typeof part === "string" ? (
      part
    ) : (
      <AppLink key={index} className="faq-link" href={part.href}>
        {part.text}
      </AppLink>
    ),
  )
}
