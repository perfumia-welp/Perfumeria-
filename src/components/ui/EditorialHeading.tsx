import { Fragment } from "react"
import type { EditorialHeading as EditorialHeadingContent } from "@/types/content"

function renderLine(line: string, emphasis?: string) {
  const start = emphasis ? line.indexOf(emphasis) : -1
  if (!emphasis || start === -1) return line

  return (
    <>
      {line.slice(0, start)}
      <em>{emphasis}</em>
      {line.slice(start + emphasis.length)}
    </>
  )
}

/** Renders an editorial headline with explicit line breaks and an italic accent word. */
export default function EditorialHeading({
  as: Heading = "h2",
  heading,
  id,
  className,
}: {
  as?: "h1" | "h2"
  heading: EditorialHeadingContent
  id?: string
  className?: string
}) {
  return (
    <Heading
      id={id}
      className={
        className ? `editorial-heading ${className}` : "editorial-heading"
      }
    >
      {heading.lines.map((line, index) => (
        <Fragment key={line}>
          {index > 0 && <br />}
          {renderLine(line, heading.emphasis)}
        </Fragment>
      ))}
    </Heading>
  )
}
