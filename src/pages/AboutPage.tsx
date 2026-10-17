import { useMemo } from "react"
import AboutAudiences from "@/components/about/AboutAudiences"
import AboutCollection from "@/components/about/AboutCollection"
import AboutDistribution from "@/components/about/AboutDistribution"
import AboutHero from "@/components/about/AboutHero"
import AboutHeritage from "@/components/about/AboutHeritage"
import AboutInvitation from "@/components/about/AboutInvitation"
import AboutQuality from "@/components/about/AboutQuality"
import AboutStory from "@/components/about/AboutStory"
import AboutValues from "@/components/about/AboutValues"
import AboutWhy from "@/components/about/AboutWhy"
import { getAboutContent } from "@/data/about"
import { aboutCompany } from "@/data/aboutCompany"
import { useI18n } from "@/i18n/i18nContext"
import "./AboutPage.css"

/*
 * English renders the owner-approved company story (data/aboutCompany.ts).
 * Arabic keeps the earlier About page until approved Arabic copy exists.
 */
export default function AboutPage() {
  const { t, locale } = useI18n()
  const about = useMemo(() => getAboutContent(t), [t])

  if (locale === "ar") {
    return (
      <>
        <AboutHero content={about.hero} />
        <AboutStory content={about.story} />
        <AboutWhy content={about.why} />
        <AboutValues content={about.values} />
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
