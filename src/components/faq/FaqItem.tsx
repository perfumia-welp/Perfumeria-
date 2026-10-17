import type { FaqQuestion } from "@/data/faq"
import FaqRichText from "./FaqRichText"
import "./FaqItem.css"

interface FaqItemProps {
  item: FaqQuestion
  open: boolean
  onToggle: (id: string) => void
}

/*
 * One question: a heading button (aria-expanded) and its answer panel. The
 * panel animates its height with a grid row; while closed it is inert, so
 * its links are neither focusable nor announced.
 */
export default function FaqItem({ item, open, onToggle }: FaqItemProps) {
  const triggerId = `${item.id}-question`
  const panelId = `${item.id}-answer`

  return (
    <div id={item.id} className={`faq-item${open ? " is-open" : ""}`}>
      <h3 className="faq-item__heading">
        <button
          type="button"
          id={triggerId}
          className="faq-item__trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(item.id)}
        >
          <span className="faq-item__question">{item.question}</span>
          <span className="faq-item__marker" aria-hidden="true" />
        </button>
      </h3>
      <div id={panelId} className="faq-item__panel" inert={!open}>
        <div className="faq-item__clip">
          <p className="faq-item__answer">
            <FaqRichText text={item.answer} />
          </p>
        </div>
      </div>
    </div>
  )
}
