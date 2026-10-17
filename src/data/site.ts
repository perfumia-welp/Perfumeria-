import type { Messages } from "@/i18n/messages"
import type {
  FooterContent,
  FooterGroup,
  NavigationItem,
  SocialLink,
  SocialPlatform,
} from "@/types/content"
import { company, whatsappChatUrl } from "@/config/company"
import { paths, productsWith } from "@/router/paths"

/*
 * Navigation and site-wide links. Destinations live here; labels come from
 * the current language's messages. Hrefs are English app paths: AppLink
 * prefixes them for the current language (/about → /ar/about).
 * Items without `href` are placeholders until the real company routes exist.
 */

export const brand = {
  /** The wordmark stays in Latin letters in every language. */
  name: "Perfumeria",
  homeHref: paths.home,
  accountHref: paths.account,
  cartHref: paths.cart,
}

export interface SiteNavigation {
  mainNavigation: NavigationItem[]
  footerGroups: FooterGroup[]
  socialLinks: SocialLink[]
  legalLinks: NavigationItem[]
  footerContent: FooterContent
}

/** The company's accounts, in the order the footer lists them. */
const socialAccounts: Record<SocialPlatform, string> = {
  instagram: company.social.instagram,
  facebook: company.social.facebook,
  tiktok: company.social.tiktok,
  telegram: company.social.telegram,
  whatsapp: whatsappChatUrl,
}

export function getSiteNavigation(t: Messages): SiteNavigation {
  const nav = t.navigation
  const { links, groups } = t.footer

  return {
    mainNavigation: [
      { label: nav.home, href: paths.home },
      { label: nav.about, href: paths.about },
      { label: nav.products, href: paths.products },
      { label: nav.contact, href: paths.contact },
    ],
    footerGroups: [
      {
        title: groups.shop,
        links: [
          { label: links.allFragrances, href: paths.products },
          { label: links.forWomen, href: productsWith("gender", "women") },
          { label: links.forMen, href: productsWith("gender", "men") },
          { label: links.unisex, href: productsWith("gender", "unisex") },
          { label: links.wishlist, href: paths.wishlist },
        ],
      },
      {
        title: groups.customerCare,
        links: [
          { label: links.contact, href: paths.contact },
          { label: links.shippingReturns },
          { label: links.faqs },
          { label: links.trackOrder },
        ],
      },
      {
        title: groups.about,
        links: [
          { label: links.ourStory, href: paths.about },
          { label: links.ingredients },
          { label: links.journal },
          { label: links.stockists },
        ],
      },
    ],
    socialLinks: (Object.keys(socialAccounts) as SocialPlatform[]).map(
      (platform) => ({
        platform,
        label: t.footer.social[platform],
        href: socialAccounts[platform],
      }),
    ),
    legalLinks: [
      { label: t.footer.legal.privacy },
      { label: t.footer.legal.terms },
    ],
    footerContent: {
      descriptionLines: t.footer.description,
      newsletter: {
        title: t.footer.newsletter.title,
        descriptionLines: t.footer.newsletter.description,
        placeholder: t.footer.newsletter.placeholder,
      },
      copyright: t.footer.copyright,
    },
  }
}
