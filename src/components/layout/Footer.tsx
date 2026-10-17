import type {
  FooterContent,
  FooterGroup,
  NavigationItem,
  SocialLink,
} from "@/types/content"
import AppLink from "../ui/AppLink"
import SocialIcon from "../ui/SocialIcon"
import NewsletterForm from "./NewsletterForm"
import "./Footer.css"

function Lines({ lines }: { lines: string[] }) {
  return lines.map((line, index) => (
    <span key={line}>
      {index > 0 && <br />}
      {line}
    </span>
  ))
}

export default function Footer({
  brandName,
  homeHref,
  content,
  groups,
  socialLinks,
  legalLinks,
  newTabLabel,
}: {
  brandName: string
  homeHref: string
  content: FooterContent
  groups: FooterGroup[]
  socialLinks: SocialLink[]
  legalLinks: NavigationItem[]
  newTabLabel: string
}) {
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <AppLink href={homeHref} className="site-logo">
            {brandName}
          </AppLink>
          <p>
            <Lines lines={content.descriptionLines} />
          </p>
          <ul className="site-footer__socials">
            {socialLinks.map((link) => (
              <li key={link.platform}>
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  <SocialIcon platform={link.platform} />
                  {link.label}
                  <span className="visually-hidden"> ({newTabLabel})</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="site-footer__links">
          {groups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="site-footer__heading">{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.label}>
                    <AppLink href={link.href}>{link.label}</AppLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="site-footer__newsletter">
            <h2 className="site-footer__heading">{content.newsletter.title}</h2>
            <p>
              <Lines lines={content.newsletter.descriptionLines} />
            </p>
            <NewsletterForm placeholder={content.newsletter.placeholder} />
          </div>
        </div>
      </div>

      <div className="site-footer__bottom">
        <span>{content.copyright}</span>
        <ul>
          {legalLinks.map((link) => (
            <li key={link.label}>
              <AppLink href={link.href}>{link.label}</AppLink>
            </li>
          ))}
        </ul>
        {content.locations && <span>{content.locations}</span>}
      </div>
    </footer>
  )
}
