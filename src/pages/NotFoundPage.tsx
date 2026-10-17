import PageIntro from "@/components/ui/PageIntro"
import TextLink from "@/components/ui/TextLink"
import { useI18n } from "@/i18n/i18nContext"
import { paths } from "@/router/paths"
import "./NotFoundPage.css"

export default function NotFoundPage() {
  const copy = useI18n().t.notFound
  return (
    <div className="not-found">
      <PageIntro intro={copy.intro}>
        <div className="not-found__links">
          <TextLink link={{ label: copy.home, href: paths.home }} />
          <TextLink link={{ label: copy.explore, href: paths.products }} />
        </div>
      </PageIntro>
    </div>
  )
}
