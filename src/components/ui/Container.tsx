import type { ComponentPropsWithoutRef } from "react"

type ContainerProps = ComponentPropsWithoutRef<"div"> & {
  as?: "div" | "section"
}

/** Constrains content to the shared page grid (max width + responsive gutters). */
export default function Container({
  as: Element = "div",
  className,
  ...props
}: ContainerProps) {
  return (
    <Element
      className={className ? `page-container ${className}` : "page-container"}
      {...props}
    />
  )
}
