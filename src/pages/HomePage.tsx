import { lazy, Suspense, useMemo } from "react"
import CategorySection from "@/components/home/CategorySection"
import HeroCampaign from "@/components/home/HeroCampaign"
import InstagramSection from "@/components/home/InstagramSection"
import OffersSection from "@/components/home/OffersSection"
import SpecialOffer from "@/components/home/SpecialOffer"
import TestimonialCarousel from "@/components/home/TestimonialCarousel"
import { getHomeContent } from "@/data/home"
import { useI18n } from "@/i18n/i18nContext"
import { siteSchema, sitePath } from "@/lib/seo"
import { useStructuredData } from "@/lib/structuredData"
import { paths } from "@/router/paths"
import { useCatalogState } from "@/hooks/useCatalogState"
import { getFeaturedProducts, productSource } from "@/services/catalog"

/*
 * The customer hero is Hero B (Campaign), chosen by the client 2026-10-22.
 * Hero A (Hero.tsx) and Hero C (HeroPerfume.tsx) stay in the repository but
 * are not rendered for visitors on any host.
 *
 * Developer only: on the Vite dev server, /?compare-hero (or =a, =b, =c)
 * opens the old A/B/C comparison. `import.meta.env.DEV` is false in every
 * build (Cloudflare preview and perfumira.net), so the comparison, its
 * switch and Heroes A and C are compiled out of the site entirely.
 */
const HeroComparison =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has("compare-hero")
    ? lazy(() => import("@/components/home/HeroComparison"))
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
        <HeroCampaign content={home.hero} />
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
