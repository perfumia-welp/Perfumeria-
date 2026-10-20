import { lazy, Suspense, useMemo } from "react"
import CategorySection from "@/components/home/CategorySection"
import Hero from "@/components/home/Hero"
import InstagramSection from "@/components/home/InstagramSection"
import OffersSection from "@/components/home/OffersSection"
import SpecialOffer from "@/components/home/SpecialOffer"
import TestimonialCarousel from "@/components/home/TestimonialCarousel"
import { getHomeContent } from "@/data/home"
import { designPreview } from "@/config/designPreview"
import { useI18n } from "@/i18n/i18nContext"
import { siteSchema, sitePath } from "@/lib/seo"
import { useStructuredData } from "@/lib/structuredData"
import { paths } from "@/router/paths"
import { useCatalogState } from "@/hooks/useCatalogState"
import { getFeaturedProducts, productSource } from "@/services/catalog"

/*
 * The hero A/B/C comparison is a design-review tool: shown on the dev server
 * and on the Cloudflare review preview (config/designPreview.ts). In the
 * production build the flag is false, so it is never loaded. Opening on the
 * homepage, its chunk starts downloading with the app (in parallel with the
 * catalogue) instead of after the catalogue has arrived.
 */
const loadHeroComparison = () => import("@/components/home/HeroComparison")
const opensOnHome = /^\/(ar\/?)?$/.test(
  window.location.pathname.slice(import.meta.env.BASE_URL.replace(/\/$/, "").length),
)
const heroComparison = designPreview && opensOnHome ? loadHeroComparison() : undefined
const HeroComparison = designPreview
  ? // A failed early download is retried when the hero first renders.
    lazy(() => heroComparison?.catch(loadHeroComparison) ?? loadHeroComparison())
  : null

export default function HomePage() {
  const { t, locale, localize } = useI18n()
  useStructuredData(
    "site-structured-data",
    siteSchema(sitePath(localize(paths.home)), locale),
  )
  const home = useMemo(() => getHomeContent(t), [t])
  const { version } = useCatalogState()
  const offerProducts = useMemo(
    () => getFeaturedProducts(locale),
    [locale, version],
  )

  return (
    <>
      {HeroComparison ? (
        // Blank while the comparison chunk loads, so no other hero flashes first.
        <Suspense fallback={<div style={{ height: "clamp(620px, 44vw, 660px)" }} />}>
          <HeroComparison content={home.hero} />
        </Suspense>
      ) : (
        <Hero content={home.hero} />
      )}
      <OffersSection intro={home.offersIntro} products={offerProducts} />
      {/* Its 20% code is placeholder content, not a company offer: never shown with live products. */}
      {productSource !== "live" && <SpecialOffer offer={home.specialOffer} />}
      <CategorySection
        intro={home.categoriesIntro}
        featured={home.featuredCategory}
        secondary={home.secondaryCategories}
        support={home.categorySupport}
      />
      <TestimonialCarousel
        intro={home.testimonialsIntro}
        testimonials={home.testimonials}
      />
      <InstagramSection content={home.instagram} />
    </>
  )
}
