import ContactForm from "@/components/contact/ContactForm"
import AppLink from "@/components/ui/AppLink"
import Container from "@/components/ui/Container"
import PageIntro from "@/components/ui/PageIntro"
import { getContactDetails } from "@/data/contact"
import { useI18n } from "@/i18n/i18nContext"
import "./ContactPage.css"

const pad = (value: number) => String(value).padStart(2, "0")

export default function ContactPage() {
  const { t } = useI18n()
  const copy = t.contact
  const contactDetails = getContactDetails(t)

  return (
    <div className="contact-page">
      <PageIntro intro={copy.intro} />

      <Container
        as="section"
        className="contact-main"
        aria-label={copy.mainLabel}
      >
        <div className="contact-info">
          <p className="contact-info__intro">{copy.infoIntro}</p>
          <dl className="contact-info__details">
            {contactDetails.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>
                  {detail.href ? (
                    <AppLink href={detail.href}>
                      {detail.lines.join(" ")}
                    </AppLink>
                  ) : (
                    detail.lines.map((line) => (
                      <span key={line}>
                        {detail.ltr ? <bdi dir="ltr">{line}</bdi> : line}
                      </span>
                    ))
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <ContactForm />
      </Container>

      <Container
        as="section"
        className="contact-help"
        aria-label={copy.helpLabel}
      >
        <ul>
          {copy.help.map((service, index) => (
            <li key={service.title}>
              <span aria-hidden="true">{pad(index + 1)}</span>
              <h2>{service.title}</h2>
              <p>{service.text}</p>
            </li>
          ))}
        </ul>
      </Container>
    </div>
  )
}
