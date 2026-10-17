import CatalogGate from "./services/products/CatalogGate"
import { RouterProvider } from "react-router"
import AuthProvider from "./auth/AuthProvider"
import BagProvider from "./cart/BagProvider"
import LocaleProvider from "./i18n/LocaleProvider"
import { router } from "./router/router"
import WishlistProvider from "./wishlist/WishlistProvider"

/*
 * Auth, the bag and the wishlist sit above the router so their state survives
 * page navigation and language switches. The locale provider follows the
 * router (the URL decides the language) and wraps them, so their
 * announcements are translated too.
 */
export default function App() {
  return (
    <CatalogGate>
      <LocaleProvider router={router}>
        <AuthProvider>
          <BagProvider>
            <WishlistProvider>
              <RouterProvider router={router} />
            </WishlistProvider>
          </BagProvider>
        </AuthProvider>
      </LocaleProvider>
    </CatalogGate>
  )
}
