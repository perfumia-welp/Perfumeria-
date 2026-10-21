import { useMemo } from "react"
import AboutAudiences from "@/components/about/AboutAudiences"
import AboutCollection from "@/components/about/AboutCollection"
import AboutDistribution from "@/components/about/AboutDistribution"
import AboutHero from "@/components/about/AboutHero"
import AboutHeritage from "@/components/about/AboutHeritage"
import AboutInvitation from "@/components/about/AboutInvitation"
import AboutQuality from "@/components/about/AboutQuality"
import { getAboutContent, getArabicAboutSections } from "@/data/about"
import { aboutCompany } from "@/data/aboutCompany"
import { useI18n } from "@/i18n/i18nContext"
import "./AboutPage.css"

/*
 * English renders the owner-approved company story (data/aboutCompany.ts).
 * Arabic uses the same approved layout for the hero and Sections 01 and 02,
 * filled with the existing Arabic copy only (data/about.ts), until approved
 * Arabic copy of the full story exists.
 */
export default function AboutPage() {
  const { t, locale } = useI18n()
  const about = useMemo(() => getAboutContent(t), [t])

  if (locale === "ar") {
    const sections = getArabicAboutSections(t)
    return (
      <>
        <AboutHero content={about.hero} />
        <AboutHeritage content={sections.heritage} />
        <AboutCollection content={sections.collection} />
      </>
    )
  }

  const content = aboutCompany
  return (
    <>
      <AboutHero content={content.hero} />
      <AboutHeritage content={content.heritage} />
      <AboutCollection content={content.collection} />
      <AboutQuality content={content.quality} />
      <AboutDistribution content={content.distribution} />
      <AboutAudiences content={content.audiences} />
      <AboutInvitation content={content.invitation} />
    </>
  )
}
