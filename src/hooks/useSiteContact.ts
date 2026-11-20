import { useEffect, useState } from "react"
import {
  DEFAULT_SITE_CONTACT,
  fetchSiteContact,
  type SiteContact,
} from "@/services/siteContact"

/*
 * One read per tab: the first Contact page visit asks the server, later
 * visits reuse the answer. Until it arrives (or if it fails) the configured
 * defaults render, so the page never waits, flashes empty or shifts.
 */
let loaded: SiteContact | null = null
let pending: Promise<SiteContact | null> | null = null

function readOnce() {
  pending ??= fetchSiteContact()
    .then((contact) => (loaded = contact))
    .catch((error) => {
      console.warn("Contact details: using the configured values", error)
      pending = null // a later visit may try again
      return null
    })
  return pending
}

export function useSiteContact(): SiteContact {
  const [contact, setContact] = useState<SiteContact>(
    () => loaded ?? DEFAULT_SITE_CONTACT,
  )
  useEffect(() => {
    if (loaded) return
    let active = true
    void readOnce().then((value) => {
      if (active && value) setContact(value)
    })
    return () => {
      active = false
    }
  }, [])
  return contact
}
