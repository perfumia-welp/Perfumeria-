import { useEffect } from "react"
import { useLocation, useParams } from "react-router"
import FaqRichText from "@/components/faq/FaqRichText"
import AppLink from "@/components/ui/AppLink"
import Container from "@/components/ui/Container"
import Icon from "@/components/ui/Icon"
import PageIntro from "@/components/ui/PageIntro"
import { findGuide } from "@/data/guides"
import { useI18n } from "@/i18n/i18nContext"
import { localizePath } from "@/i18n/locales"
import { articleSchema, breadcrumbSchema, sitePath } from "@/lib/seo"
import { useStructuredData } from "@/lib/structuredData"
import { guidePath, paths } from "@/router/paths"
import type { GuideContent, GuideFact } from "@/types/guide"
import NotFoundPage from "./NotFoundPage"
import "./GuidePage.css"

const pad = (value: number) => String(value).padStart(2, "0")

/** A fact's value, or the "To be confirmed" marker while the owner has not confirmed it. */
function FactValue({ fact, unconfirmed }: { fact: GuideFact; unconfirmed: string }) {
  return (
    <>
      {fact.value === null ? (
        <span className="guide-fact__pending">{unconfirmed}</span>
      ) : (
        <span className="guide-fact__value">{fact.value}</span>
      )}
      {fact.note && <span className="guide-fact__note">{fact.note}</span>}
    </>
  )
}

/** Article + BreadcrumbList, from the guide's own content (English page only). */
function guideSchemas(guide: GuideContent, homeName: string) {
  const path = sitePath(localizePath(guidePath(guide.slug), "en"))
  return [
    articleSchema({
      headline: guide.title,
      description: guide.seo.description,
      path,
      datePublished: guide.datePublished,
      dateModified: guide.dateModified,
      locale: "en",
    }),
    breadcrumbSchema([
      { name: homeName, path: sitePath(localizePath(paths.home, "en")) },
      { name: guide.title, path },
    ]),
  ]
}

/*
 * Fragrance guide template (/guides/:slug). The content comes from
 * data/guides. English-only guides follow the FAQ pattern: other languages
 * show the English copy, marked lang="en", under a short notice, and carry
 * no structured data (their canonical is the English URL).
 */
export default function GuidePage() {
  const { slug = "" } = useParams()
  const guide = findGuide(slug)
  if (!guide) return <NotFoundPage />
  return <Guide key={guide.slug} guide={guide} />
}

function Guide({ guide }: { guide: GuideContent }) {
  const { t, locale } = useI18n()
  const { hash } = useLocation()
  const inPageLanguage = locale === "en" || !guide.englishOnly
  const english = locale === "en"
  const { comparison, chrome } = guide
  const sectionCount = 1 + guide.entries.length + guide.sections.length

  const schemas = english ? guideSchemas(guide, t.meta.breadcrumb.home) : null
  useStructuredData("guide-article", schemas?.[0] ?? null)
  useStructuredData("guide-breadcrumb", schemas?.[1] ?? null)

  // A deep link (#eau-de-parfum) lands on its section once the page has rendered.
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1))
    if (!id) return
    const frame = requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ block: "start" }),
    )
    return () => cancelAnimationFrame(frame)
  }, [hash])

  return (
    <div className="guide-page">
      {!inPageLanguage && (
        <Container className="guide-page__notice">
          <p>{t.guide.englishOnly}</p>
        </Container>
      )}

      <article
        className="guide-page__content"
        lang={inPageLanguage ? undefined : "en"}
        dir={inPageLanguage ? undefined : "ltr"}
      >
        <PageIntro
          intro={{ eyebrow: guide.eyebrow, title: guide.title, lead: guide.lead }}
          meta={chrome.meta}
        />

        <Container
          as="section"
          className="guide-glance"
          aria-labelledby={`${comparison.id}-title`}
        >
          <header className="guide-section__header">
            <span className="guide-section__number" aria-hidden="true">
              {pad(1)}
            </span>
            <h2 id={`${comparison.id}-title`} className="guide-section__title">
              {comparison.title}
            </h2>
          </header>

          <table className="guide-table">
            <caption className="visually-hidden">{comparison.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{comparison.entryLabel}</th>
                {comparison.columns.map((column) => (
                  <th key={column.key} scope="col">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guide.entries.map((entry) => (
                <tr key={entry.id}>
                  <th scope="row" className="guide-table__entry">
                    <AppLink className="guide-table__name" href={`#${entry.id}`}>
                      {entry.name}
                    </AppLink>
                    {(entry.abbreviation ?? entry.alias) && (
                      <span className="guide-table__tag">
                        {entry.abbreviation ?? entry.alias}
                      </span>
                    )}
                  </th>
                  {comparison.columns.map((column) => (
                    <td
                      key={column.key}
                      className="guide-fact"
                      data-label={column.label}
                    >
                      <FactValue
                        fact={entry.facts[column.key]}
                        unconfirmed={chrome.unconfirmed}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Container>

        {guide.entries.map((entry, index) => (
          <Container
            key={entry.id}
            as="section"
            id={entry.id}
            className="guide-section"
            aria-labelledby={`${entry.id}-title`}
          >
            <header className="guide-section__header">
              <span className="guide-section__number" aria-hidden="true">
                {pad(index + 2)}
              </span>
              <h2 id={`${entry.id}-title`} className="guide-section__title">
                {entry.abbreviation
                  ? `${entry.name} (${entry.abbreviation})`
                  : entry.name}
              </h2>
              {entry.alias && (
                <p className="guide-section__alias">{entry.alias}</p>
              )}
            </header>
            <div className="guide-section__body">
              <dl className="guide-facts">
                {comparison.columns.map((column) => (
                  <div key={column.key} className="guide-facts__item guide-fact">
                    <dt>{column.label}</dt>
                    <dd>
                      <FactValue
                        fact={entry.facts[column.key]}
                        unconfirmed={chrome.unconfirmed}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="guide-section__lede">{entry.details}</p>
            </div>
          </Container>
        ))}

        {guide.sections.map((section, index) => (
          <Container
            key={section.id}
            as="section"
            id={section.id}
            className="guide-section"
            aria-labelledby={`${section.id}-title`}
          >
            <header className="guide-section__header">
              <span className="guide-section__number" aria-hidden="true">
                {pad(index + 2 + guide.entries.length)}
              </span>
              <h2 id={`${section.id}-title`} className="guide-section__title">
                {section.title}
              </h2>
            </header>
            <div className="guide-section__body">
              {section.paragraphs.map((paragraph, key) => (
                <p key={key} className="guide-section__lede">
                  <FaqRichText text={paragraph} />
                </p>
              ))}
            </div>
          </Container>
        ))}

        <Container
          as="section"
          id={guide.explore.id}
          className="guide-section guide-explore"
          aria-labelledby={`${guide.explore.id}-title`}
        >
          <header className="guide-section__header">
            <span className="guide-section__number" aria-hidden="true">
              {pad(sectionCount + 1)}
            </span>
            <h2 id={`${guide.explore.id}-title`} className="guide-section__title">
              {guide.explore.title}
            </h2>
          </header>
          <div className="guide-section__body">
            <ul className="guide-explore__links" role="list">
              {guide.explore.links.map((link) => (
                <li key={link.href}>
                  <AppLink className="guide-explore__link" href={link.href}>
                    <span>{link.text}</span>
                    <Icon name="arrow" />
                  </AppLink>
                </li>
              ))}
            </ul>
            <div className="guide-explore__help">
              <p>{guide.explore.help.text}</p>
              <AppLink className="button-primary" href={guide.explore.help.link.href}>
                <span>{guide.explore.help.link.text}</span>
                <Icon name="arrow" />
              </AppLink>
            </div>
          </div>
        </Container>
      </article>
    </div>
  )
}
