/* The wishlist page and its announcements. */
export default {
  intro: {
    eyebrow: "Saved fragrances",
    title: "Wishlist",
    lead: "Fragrances you’ve saved to return to. Your wishlist is kept on this device.",
  },
  empty: {
    title: "Your wishlist is empty.",
    text: "Tap the heart on any fragrance to save it here.",
    action: "Explore Fragrances",
  },
  saved: (name: string) => `${name} saved to your wishlist`,
  removed: (name: string) => `${name} removed from your wishlist`,
}
