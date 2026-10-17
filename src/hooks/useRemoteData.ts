import { useCallback, useEffect, useRef, useState } from "react"
import type { AccountResult } from "@/types/account"

/* Named interfaces only (oxfmt 0.2.0 mangles single-line object types). */
interface RemoteLoading {
  status: "loading"
}

interface RemoteReady<T> {
  status: "ready"
  data: T
}

interface RemoteFailed {
  status: "error"
}

export type RemoteData<T> = RemoteLoading | RemoteReady<T> | RemoteFailed

/**
 * Loads account data for `key` (the signed-in user id) and reloads it when
 * the key changes or `reload()` is called. On `reload()` the data already
 * shown stays on screen until the new data arrives; late responses for an
 * old key are ignored. An empty key loads nothing.
 */
export function useRemoteData<T>(
  load: () => Promise<AccountResult<T>>,
  key: string,
) {
  const [state, setState] = useState<RemoteData<T>>({ status: "loading" })
  const [version, setVersion] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load
  const loadedKey = useRef(key)

  useEffect(() => {
    if (!key) return
    let current = true
    // Another user's data is never kept on screen.
    const sameKey = loadedKey.current === key
    loadedKey.current = key
    setState((previous) =>
      sameKey && previous.status === "ready" ? previous : { status: "loading" },
    )
    loadRef.current().then((result) => {
      if (!current) return
      setState(
        result.ok
          ? { status: "ready", data: result.data }
          : { status: "error" },
      )
    })
    return () => {
      current = false
    }
  }, [key, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])
  /** Replaces the shown data, e.g. with the result of a save. */
  const replace = useCallback(
    (data: T) => setState({ status: "ready", data }),
    [],
  )
  return { state, reload, replace }
}
