import type { ComponentPropsWithoutRef, MouseEvent } from "react"
import { Link } from "react-router"
import { useI18n } from "@/i18n/i18nContext"

type AppLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href?: string
}

/** Site routes ("/products") and in-page anchors ("#products") are handled by the router. */
const isInternalRoute = (href: string) =>
  (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#")

/**
 * The single link primitive for the site.
 * - Internal routes ("/products?gender=women") and in-page anchors ("#products")
 *   navigate client-side via React Router, which also applies the deployment base
 *   path and scrolls to anchor targets. Routes are written as English paths and
 *   kept in the current language here ("/products" → "/ar/products").
 * - External URLs (mailto:, https:) stay native links.
 * - Without an `href` it is a placeholder: still focusable, but it does not jump to the top.
 */
export default function AppLink({ href, onClick, ...props }: AppLinkProps) {
  const { localize } = useI18n()

  if (href && isInternalRoute(href)) {
    return <Link to={localize(href)} onClick={onClick} {...props} />
  }
  if (href) return <a href={href} onClick={onClick} {...props} />

  const preventPlaceholderJump = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    onClick?.(event)
  }

  return <a href="#" onClick={preventPlaceholderJump} {...props} />
}
