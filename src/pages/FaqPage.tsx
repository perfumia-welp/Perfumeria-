import { useEffect, useState, type KeyboardEvent } from "react"
import { useLocation } from "react-router"
import FaqClosing from "@/components/faq/FaqClosing"
import FaqItem from "@/components/faq/FaqItem"
import FaqRichText from "@/components/faq/FaqRichText"
import AppLink from "@/components/ui/AppLink"
import Container from "@/components/ui/Container"
import PageIntro from "@/components/ui/PageIntro"
import { faq, plainText } from "@/data/faq"
import { useI18n } from "@/i18n/i18nContext"
import { getMessages } from "@/i18n/messages"
import { useStructuredData } from "@/lib/structuredData"
import "./FaqPage.css"

const questions = faq.groups.flatMap((group) => group.questions)
const questionIds = new Set(questions.map((question) => question.id))

/** FAQPage JSON-LD: exactly the questions shown, answers as plain text. */
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: questions.map((question) => ({
    "@type": "Question",
    name: question.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: plainText(question.answer),
    },
  })),
}

const pad = (value: number) => String(value).padStart(2, "0")

/** The question a URL hash such as #delivery-time points to, if any. */
const questionFromHash = (hash: string) => {
  const id = decodeURIComponent(hash.slice(1))
  return questionIds.has(id) ? id : null
}

/*
 * The owner-approved FAQ is English only. Other languages show it as is,
 * marked lang="en", with a short notice; /ar/faq points to /faq as its
 * canonical (route handle `englishOnly`) and carries no structured data.
 */
export default function FaqPage() {
  const { t, locale } = useI18n()
  const isEnglish = locale === "en"
  const chrome = getMessages("en").faq
  const { hash } = useLocation()

  // Several answers may stay open at once, so visitors can compare them.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => {
    const id = questionFromHash(hash)
    return new Set(id ? [id] : [])
  })

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  // A deep link (/faq#delivery-time) opens its question and brings it into view.
  useEffect(() => {
    const id = questionFromHash(hash)
    if (!id) return
    setOpen((current) => (current.has(id) ? current : new Set(current).add(id)))
    const frame = requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ block: "start" }),
    )
    return () => cancelAnimationFrame(frame)
  }, [hash])

  useStructuredData("faq-structured-data", isEnglish ? faqSchema : null)

  // Arrow keys, Home and End move between questions (WAI-ARIA accordion).
  const moveBetweenQuestions = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (!target.classList.contains("faq-item__trigger")) return
    const triggers = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        ".faq-item__trigger",
      ),
    )
    const index = triggers.indexOf(target as HTMLButtonElement)
    const last = triggers.length - 1
    const targets: Partial<Record<string, number>> = {
      ArrowDown: index === last ? 0 : index + 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }
    const next = targets[event.key]
    if (next === undefined) return
    event.preventDefault()
    triggers[next].focus()
  }

  return (
    <div className="faq-page">
      {!isEnglish && (
        <Container className="faq-page__notice">
          <p>{t.faq.englishOnly}</p>
        </Container>
      )}

      <div
        className="faq-page__content"
        lang={isEnglish ? undefined : "en"}
        dir={isEnglish ? undefined : "ltr"}
      >
        <PageIntro
          intro={{ eyebrow: chrome.eyebrow, title: faq.title, lead: faq.intro }}
          meta={chrome.questionCount(questions.length)}
        >
          <p className="faq-page__assistance">
            <FaqRichText text={faq.assistance} />
          </p>
        </PageIntro>

        <Container className="faq-body">
          <nav className="faq-index" aria-label={chrome.topicsLabel}>
            <p className="eyebrow">{chrome.topicsLabel}</p>
            <ol className="faq-index__list">
              {faq.groups.map((group, index) => (
                <li key={group.id}>
                  <AppLink className="faq-index__link" href={`#${group.id}`}>
                    <span className="faq-index__number" aria-hidden="true">
                      {pad(index + 1)}
                    </span>
                    <span className="faq-index__title">{group.title}</span>
                  </AppLink>
                </li>
              ))}
            </ol>
          </nav>

          <div className="faq-groups" onKeyDown={moveBetweenQuestions}>
            {faq.groups.map((group, index) => (
              <section
                key={group.id}
                id={group.id}
                className="faq-group"
                aria-labelledby={`${group.id}-title`}
              >
                <header className="faq-group__header">
                  <span className="faq-group__number" aria-hidden="true">
                    {pad(index + 1)}
                  </span>
                  <h2 id={`${group.id}-title`} className="faq-group__title">
                    {group.title}
                  </h2>
                </header>
                {group.questions.map((question) => (
                  <FaqItem
                    key={question.id}
                    item={question}
                    open={open.has(question.id)}
                    onToggle={toggle}
                  />
                ))}
              </section>
            ))}
          </div>
        </Container>

        <FaqClosing content={faq.closing} />
      </div>
    </div>
  )
}
