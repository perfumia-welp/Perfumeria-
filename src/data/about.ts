import type { Messages } from "@/i18n/messages"
import type {
  AboutHeroContent,
  AboutStoryContent,
  AboutValue,
  AboutValuesContent,
  AboutWhyContent,
  CaptionedImage,
  ImageAsset,
  VideoAsset,
} from "@/types/content"
import { unsplashImage } from "./mockImages"

/*
 * The earlier About page, now rendered only on /ar/about until approved
 * Arabic copy of the owner's company story exists (English uses
 * data/aboutCompany.ts). Photography is temporary Unsplash imagery; the
 * words come from the `about` messages.
 */

const heroImage = unsplashImage("1608721279136-cd41b752fa41", "", {
  width: 1400,
  quality: 88,
  widths: [700, 1000, 1400, 2000],
})

const storyImage = unsplashImage("1588405748880-12d1d2a59f75", "", {
  width: 1200,
  quality: 88,
  widths: [600, 900, 1200, 1600],
})

// Client-supplied stock footage, re-encoded for the web; the poster is its first frame.
const whyImage: ImageAsset = {
  src: `${import.meta.env.BASE_URL}images/about/about-why-poster.webp`,
  alt: "",
}

const whyVideo: VideoAsset = {
  src: `${import.meta.env.BASE_URL}videos/about-why-perfumeria.mp4`,
  type: "video/mp4",
}

const valueIcons: AboutValue["icon"][] = ["drop", "seal", "heart"]

const visual = (
  image: ImageAsset,
  alt: string,
  caption: string,
  position: string,
): CaptionedImage => ({ image: { ...image, alt }, caption, position })

export interface AboutContent {
  hero: AboutHeroContent
  story: AboutStoryContent
  why: AboutWhyContent
  values: AboutValuesContent
}

/** The About page in one language. */
export function getAboutContent(t: Messages): AboutContent {
  const { hero, story, why, values } = t.about
  return {
    hero: {
      eyebrow: hero.eyebrow,
      title: hero.title,
      lead: hero.lead,
      signature: hero.signature,
      visual: visual(heroImage, hero.imageAlt, hero.caption, "center 51%"),
    },
    story: {
      eyebrow: story.eyebrow,
      title: story.title,
      paragraphs: story.paragraphs,
      visual: visual(storyImage, story.imageAlt, story.caption, "center 56%"),
    },
    why: {
      eyebrow: why.eyebrow,
      title: why.title,
      intro: why.intro,
      reasons: why.reasons,
      visual: {
        ...visual(whyImage, why.imageAlt, why.caption, "center 38%"),
        video: whyVideo,
      },
    },
    values: {
      eyebrow: values.eyebrow,
      title: values.title,
      values: values.items.map((value, index) => ({
        icon: valueIcons[index],
        ...value,
      })),
    },
  }
}
