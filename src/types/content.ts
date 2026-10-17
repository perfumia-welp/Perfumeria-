/**
 * Content interfaces consumed by the UI.
 *
 * Components depend only on these shapes, never on where the data comes from.
 * When the real API is connected, map its responses to these types in an
 * adapter and pass the result to the same components.
 */

/** A link whose destination may not exist yet. A missing `href` renders a placeholder link. */
export interface NavigationItem {
  label: string
  href?: string
}

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "telegram"
  | "whatsapp"

/** A link to one of the company's social accounts, shown with its brand mark. */
export interface SocialLink {
  platform: SocialPlatform
  label: string
  href: string
}

export interface ImageAsset {
  src: string
  srcSet?: string
  alt: string
}

/** Headline split into editorial lines; `emphasis` is rendered in the italic accent style. */
export interface EditorialHeading {
  lines: string[]
  emphasis?: string
}

export interface Category {
  id: string
  name: string
  label: string
  ctaLabel: string
  href?: string
  image: ImageAsset
}

export interface Testimonial {
  id: string
  quote: string
  rating: number
  author: {
    name: string
    role?: string
    avatar?: ImageAsset
  }
}

/** One preview in the Instagram section. It links to the profile, not to a post. */
export interface InstagramPost {
  id: string
  /** Short theme shown on the card, e.g. "New arrivals". */
  label: string
  image: ImageAsset
}

export interface InstagramContent {
  /** Account handle, e.g. "@perfumiraegy". The same in every language. */
  handle: string
  title: string
  description: string
  /** The profile link; every card uses the same destination. */
  cta: NavigationItem & { href: string }
  /** Call to action shown on each card. */
  viewLabel: string
  /** Read after the name of a link that opens in a new tab. */
  newTabLabel: string
  posts: InstagramPost[]
}

export interface SpecialOffer {
  eyebrow: string
  heading: EditorialHeading
  description: string
  discountLabel: string
  codeLabel: string
  code: string
  cta: NavigationItem
  /** Still frame: the video poster and the reduced-motion fallback. */
  image: ImageAsset
  video?: VideoAsset
  imageCaption?: string
}

export interface VideoAsset {
  src: string
  type: string
}

export interface FooterGroup {
  title: string
  links: NavigationItem[]
}

export interface SectionIntro {
  eyebrow: string
  title: string
}

export interface CategorySupport extends SectionIntro {
  description: string
  cta: NavigationItem
}

/** One mood of the hero carousel. Only these fields vary between slides. */
export interface HeroSlide {
  id: string
  /** Short mood label, e.g. "Floral / Soft". Also used to announce the slide. */
  mood: string
  /** Scent-note micro labels shown on the image. Decorative. */
  notes: string[]
  description: string
  image: ImageAsset
  /** CSS object-position used to keep the bottle in frame. */
  imagePosition?: string
}

export interface HeroContent {
  eyebrow: string
  heading: EditorialHeading
  cta: NavigationItem
  slides: HeroSlide[]
}

export interface NewsletterContent {
  title: string
  descriptionLines: string[]
  placeholder: string
}

export interface FooterContent {
  descriptionLines: string[]
  newsletter: NewsletterContent
  copyright: string
  /** Office locations. Omitted until the company confirms real details. */
  locations?: string
}

export interface PageIntroContent {
  eyebrow: string
  title: string
  lead?: string
}

/** An editorial image with an optional decorative caption overlaid on it. */
export interface CaptionedImage {
  image: ImageAsset
  /** Looping muted footage; `image` is then its poster and reduced-motion still. */
  video?: VideoAsset
  caption?: string
  /** CSS object-position for an intentional crop. */
  position?: string
}

export interface AboutHeroContent {
  eyebrow: string
  title: string
  lead: string
  /** Short decorative line under the lead; not a factual claim. */
  signature: string[]
  visual: CaptionedImage
}

export interface AboutStoryContent {
  eyebrow: string
  title: string
  paragraphs: string[]
  visual: CaptionedImage
}

export interface AboutReason {
  title: string
  text: string
}

export interface AboutWhyContent {
  eyebrow: string
  title: string
  intro: string
  reasons: AboutReason[]
  visual: CaptionedImage
}

export interface AboutValue {
  icon: "drop" | "seal" | "heart"
  title: string
  text: string
}

export interface AboutValuesContent {
  eyebrow: string
  title: string
  values: AboutValue[]
}

/* English About page built from the owner-approved company copy. */

export interface AboutHeritageContent {
  eyebrow: string
  /** Set large as a decorative numeral; the heading carries it for readers. */
  year: string
  title: string
  paragraphs: string[]
}

/** One sentence set as a list: a lead-in, the items, then an optional close. */
export interface AboutSentenceList {
  lead: string
  items: string[]
  close?: string
}

export interface AboutCollectionContent {
  eyebrow: string
  figure: string
  figureLabel: string
  title: string
  paragraphs: string[]
  styles: AboutSentenceList
}

export interface AboutQualityContent {
  eyebrow: string
  title: string
  statement: string
  paragraphs: string[]
  visual: CaptionedImage
}

export interface AboutDistributionContent {
  eyebrow: string
  title: string
  paragraphs: string[]
  pillars: AboutSentenceList
  visual: CaptionedImage
}

export interface AboutAudienceGroup {
  label: string
  text: string
}

export interface AboutAudiencesContent {
  eyebrow: string
  title: string
  intro: string
  lead: string
  groups: AboutAudienceGroup[]
  close: string
  commitment: string
}

export interface AboutInvitationContent {
  title: string
  highlights: string[]
  text: string
  closing: string
  primary: NavigationItem
  secondary: NavigationItem
}

export interface AboutCompanyContent {
  hero: AboutHeroContent
  heritage: AboutHeritageContent
  collection: AboutCollectionContent
  quality: AboutQualityContent
  distribution: AboutDistributionContent
  audiences: AboutAudiencesContent
  invitation: AboutInvitationContent
}
