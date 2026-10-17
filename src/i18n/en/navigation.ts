/* Header, mobile menu and layout landmarks. */
export default {
  skipToContent: "Skip to content",
  main: "Main",
  home: "Home",
  about: "About",
  products: "Products",
  contact: "Contact",
  search: "Search",
  account: "Account",
  signIn: "Sign In",
  bag: "Bag",
  menu: "Menu",
  close: "Close",
  /** Group label of the EN | AR switcher. */
  language: "Language",
  brandHome: (brand: string) => `${brand} home`,
  bagLabel: (count: number) =>
    `Bag, ${count} ${count === 1 ? "item" : "items"}`,
}
