import type { Messages } from "@/i18n/messages"
import type {
  Category,
  CategorySupport,
  HeroContent,
  ImageAsset,
  InstagramContent,
  NavigationItem,
  SectionIntro,
  SpecialOffer,
  Testimonial,
} from "@/types/content"
import { company } from "@/config/company"
import { paths, productsWith } from "@/router/paths"
import { unsplashImage } from "./mockImages"

/*
 * Temporary local content taken from the approved Figma Make design.
 * Replace with API responses mapped to the same types.
 *
 * Media, crops, links and ids are shared by every language; the words come
 * from the `home` messages (i18n/<locale>/home.ts), keyed by the same ids.
 * Featured products come from the catalogue service (getFeaturedProducts).
 */

const heroImage = (photoId: string) =>
  unsplashImage(photoId, "", {
    width: 1400,
    quality: 88,
    widths: [700, 1000, 1400, 2000],
  })

const withAlt = (image: ImageAsset, alt: string): ImageAsset => ({
  ...image,
  alt,
})

type SlideId = keyof Messages["home"]["hero"]["slides"]
type CategoryId = keyof Messages["home"]["categories"]["items"]
type TestimonialId = keyof Messages["home"]["testimonials"]["items"]
type InstagramPostId = keyof Messages["home"]["instagram"]["posts"]

interface SlideMedia {
  id: SlideId
  image: ImageAsset
  imagePosition: string
}

const heroSlides: SlideMedia[] = [
  {
    id: "floral",
    image: heroImage("1676950933747-5f886cadf014"),
    imagePosition: "center 53%",
  },
  {
    id: "amber",
    image: {
      src: `${import.meta.env.BASE_URL}images/hero/amber-editorial.png`,
      alt: "",
    },
    imagePosition: "center 75%",
  },
  {
    id: "oud",
    image: {
      src: `${import.meta.env.BASE_URL}images/hero/coco-noir-perfume.jpg`,
      alt: "",
    },
    imagePosition: "60% 65%",
  },
]

interface CategoryMedia {
  id: CategoryId
  href: string
  image: ImageAsset
}

const categoryImage = (photoId: string, width: number, widths: number[]) =>
  unsplashImage(photoId, "", { width, quality: 88, widths })

const featuredCategoryMedia: CategoryMedia = {
  id: "women",
  href: productsWith("gender", "women"),
  image: categoryImage("1600086586698-368d69f00d6e", 1200, [600, 900, 1200]),
}

const secondaryCategoryMedia: CategoryMedia[] = [
  {
    id: "men",
    href: productsWith("gender", "men"),
    image: categoryImage("1644820850758-ffd841aa235c", 900, [500, 900]),
  },
  {
    id: "unisex",
    href: productsWith("gender", "unisex"),
    image: categoryImage("1648208567952-d1d4cfb98eb7", 1000, [500, 1000]),
  },
]

/*
 * Instagram previews. PLACEHOLDERS: web-sized copies (800 × 1200 webp) of the
 * hero photographs, in public/images/instagram. Replace each file, or point
 * `file` at a new one, when the client supplies real Reel thumbnails
 * (portrait, 2:3 or taller; the card crops to 2:3 from the centre).
 */
interface InstagramPostMedia {
  id: InstagramPostId
  file: string
}

const instagramPosts: InstagramPostMedia[] = [
  { id: "arrivals", file: "reel-amber.webp" },
  { id: "stories", file: "reel-silk.webp" },
  { id: "backstage", file: "reel-noir.webp" },
]

const avatar = (photoId: string) =>
  unsplashImage(photoId, "", { width: 120, quality: 80 })

interface TestimonialMedia {
  id: TestimonialId
  rating: number
  avatar: ImageAsset
}

const testimonialMedia: TestimonialMedia[] = [
  {
    id: "amelia-laurent",
    rating: 5,
    avatar: avatar("1494790108377-be9c29b29330"),
  },
  {
    id: "julian-moreau",
    rating: 5,
    avatar: avatar("1500648767791-00dcc994a43e"),
  },
  {
    id: "elise-martin",
    rating: 5,
    avatar: avatar("1534528741775-53994a69daeb"),
  },
  {
    id: "theo-bennett",
    rating: 5,
    avatar: avatar("1507003211169-0a1dd7228f2d"),
  },
  {
    id: "sofia-rossi",
    rating: 5,
    avatar: avatar("1544005313-94ddf0286df2"),
  },
]

export interface HomeContent {
  hero: HeroContent
  offersIntro: SectionIntro & { cta: NavigationItem }
  specialOffer: SpecialOffer
  categoriesIntro: SectionIntro
  categorySupport: CategorySupport
  featuredCategory: Category
  secondaryCategories: Category[]
  testimonialsIntro: SectionIntro
  testimonials: Testimonial[]
  instagram: InstagramContent
}

/** The homepage in one language. */
export function getHomeContent(t: Messages): HomeContent {
  const { hero, offers, specialOffer, categories, testimonials, instagram } =
    t.home

  const category = ({ id, href, image }: CategoryMedia): Category => ({
    id,
    name: categories.items[id].name,
    label: categories.label,
    ctaLabel: categories.cta,
    href,
    image: withAlt(image, categories.items[id].imageAlt),
  })

  return {
    hero: {
      eyebrow: hero.eyebrow,
      heading: hero.heading,
      cta: { label: hero.cta, href: "#products" },
      slides: heroSlides.map(({ id, image, imagePosition }) => ({
        id,
        mood: hero.slides[id].mood,
        notes: hero.slides[id].notes,
        description: hero.slides[id].description,
        image: withAlt(image, hero.slides[id].imageAlt),
        imagePosition,
      })),
    },
    offersIntro: {
      eyebrow: offers.eyebrow,
      title: offers.title,
      cta: { label: offers.cta, href: paths.products },
    },
    specialOffer: {
      eyebrow: specialOffer.eyebrow,
      heading: specialOffer.heading,
      description: specialOffer.description,
      discountLabel: specialOffer.discountLabel,
      codeLabel: specialOffer.codeLabel,
      code: "PRIVATE20",
      cta: { label: specialOffer.cta, href: "#products" },
      // Stock footage (Vecteezy); the poster is its first frame.
      image: {
        src: `${import.meta.env.BASE_URL}images/special-offer/special-offer-poster.webp`,
        alt: specialOffer.imageAlt,
      },
      video: {
        src: `${import.meta.env.BASE_URL}videos/special-offer.mp4`,
        type: "video/mp4",
      },
      imageCaption: specialOffer.imageCaption,
    },
    categoriesIntro: {
      eyebrow: categories.eyebrow,
      title: categories.title,
    },
    categorySupport: {
      eyebrow: categories.support.eyebrow,
      title: categories.support.title,
      description: categories.support.description,
      cta: { label: categories.support.cta, href: paths.products },
    },
    featuredCategory: category(featuredCategoryMedia),
    secondaryCategories: secondaryCategoryMedia.map(category),
    testimonialsIntro: {
      eyebrow: testimonials.eyebrow,
      title: testimonials.title,
    },
    testimonials: testimonialMedia.map(({ id, rating, avatar }) => ({
      id,
      quote: testimonials.items[id].quote,
      rating,
      author: {
        name: testimonials.items[id].name,
        role: testimonials.items[id].role,
        avatar,
      },
    })),
    instagram: {
      handle: company.instagramHandle,
      title: instagram.title,
      description: instagram.description,
      cta: { label: instagram.cta, href: company.social.instagram },
      viewLabel: instagram.view,
      newTabLabel: t.footer.social.newTab,
      posts: instagramPosts.map(({ id, file }) => ({
        id,
        label: instagram.posts[id].label,
        image: {
          src: `${import.meta.env.BASE_URL}images/instagram/${file}`,
          alt: instagram.posts[id].imageAlt,
        },
      })),
    },
  }
}
