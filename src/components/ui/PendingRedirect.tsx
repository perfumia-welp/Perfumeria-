import { Navigate, type NavigateProps } from "react-router"

/** A redirect that holds the page still (`.page-pending`) until its target shows. */
export default function PendingRedirect(props: NavigateProps) {
  return (
    <>
      <div className="page-pending" />
      <Navigate {...props} />
    </>
  )
}
