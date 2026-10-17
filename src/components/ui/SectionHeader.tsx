import type { ReactNode } from "react"
import type { SectionIntro } from "@/types/content"
import "./SectionHeader.css"

export default function SectionHeader({
  intro,
  titleId,
  action,
  className,
}: {
  intro: SectionIntro
  titleId: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={className ? `section-header ${className}` : "section-header"}
    >
      <div>
        <p className="eyebrow">{intro.eyebrow}</p>
        <h2 id={titleId}>{intro.title}</h2>
      </div>
      {action}
    </div>
  )
}
