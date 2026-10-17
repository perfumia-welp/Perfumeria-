import AppLink from "@/components/ui/AppLink"
import Container from "@/components/ui/Container"
import Icon from "@/components/ui/Icon"
import PageIntro from "@/components/ui/PageIntro"
import { useI18n } from "@/i18n/i18nContext"
import { breadcrumbSchema, sitePath } from "@/lib/seo"
import { useStructuredData } from "@/lib/structuredData"
import { paths } from "@/router/paths"
import "./ReturnsPage.css"

const pad = (value: number) => String(value).padStart(2, "0")

/** A policy term with its fee amount set apart, so the figure is easy to find. */
interface TermProps {
  text: string
  fee: string
}

function Term({ text, fee }: TermProps) {
  const [before, ...rest] = text.split(fee)
  if (!rest.length) return text
  return (
    <>
      {before}
      <strong className="returns-term__fee">
        <bdi>{fee}</bdi>
      </strong>
      {rest.join(fee)}
    </>
  )
}

/*
 * The owner-approved returns and exchanges policy for online orders. Arabic
 * is the original; English is its translation (i18n/{ar,en}/returns.ts). Both are
 * real pages, so /returns and /ar/returns declare each other as hreflang.
 */
export default function ReturnsPage() {
  const { t, localize } = useI18n()
  const copy = t.returns

  useStructuredData(
    "returns-breadcrumb",
    breadcrumbSchema([
      { name: t.meta.breadcrumb.home, path: sitePath(localize(paths.home)) },
      { name: copy.intro.title, path: sitePath(localize(paths.returns)) },
    ]),
  )

  return (
    <div className="returns-page">
      <PageIntro intro={copy.intro} />

      <Container
        as="section"
        className="returns-policy"
        aria-labelledby="returns-policy-title"
      >
        <header className="returns-policy__header">
          <h2 id="returns-policy-title" className="returns-policy__title">
            {copy.policyTitle}
          </h2>
        </header>

        <ol className="returns-terms" role="list" aria-label={copy.termsLabel}>
          {copy.terms.map((term, index) => (
            <li key={term} className="returns-term">
              <span className="returns-term__number" aria-hidden="true">
                {pad(index + 1)}
              </span>
              <p className="returns-term__text">
                <Term text={term} fee={copy.fee} />
              </p>
            </li>
          ))}
        </ol>
      </Container>

      <Container
        as="section"
        className="returns-help"
        aria-labelledby="returns-help-title"
      >
        <h2 id="returns-help-title" className="returns-help__title">
          {copy.help.title}
        </h2>
        <div className="returns-help__body">
          <p>{copy.help.text}</p>
          <div className="returns-help__actions">
            <AppLink className="button-primary" href={paths.contact}>
              <span>{copy.help.contact}</span>
              <Icon name="arrow" />
            </AppLink>
            <AppLink className="returns-help__secondary" href={paths.faq}>
              {copy.help.faq}
            </AppLink>
          </div>
        </div>
      </Container>
    </div>
  )
}
