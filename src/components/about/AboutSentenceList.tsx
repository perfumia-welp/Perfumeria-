import type { AboutSentenceList as SentenceListContent } from "@/types/content"
import "./AboutSentenceList.css"

const pad = (value: number) => String(value).padStart(2, "0")

/**
 * One owner sentence set as an editorial list: the lead-in, the items on
 * hairlines, then the close. The words still read in order.
 */
export default function AboutSentenceList({
  content,
  className,
}: {
  content: SentenceListContent
  className?: string
}) {
  return (
    <div className={["about-sentence", className].filter(Boolean).join(" ")}>
      <p className="about-sentence__lead">{content.lead}</p>
      <ol className="about-sentence__items">
        {content.items.map((item, index) => (
          <li key={item}>
            <span aria-hidden="true">{pad(index + 1)}</span>
            {item}
          </li>
        ))}
      </ol>
      {content.close && (
        <p className="about-sentence__close">{content.close}</p>
      )}
    </div>
  )
}
