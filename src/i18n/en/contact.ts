/* The contact page and form. Contact values themselves are in data/contact.ts. */
export default {
  intro: {
    eyebrow: "Contact Perfumira",
    title: "We’re here to help.",
    lead: "Questions about an order, a fragrance or anything else? Our team would be happy to assist.",
  },
  infoIntro:
    "Thoughtful guidance, personal service and answers when you need them.",
  mainLabel: "Contact details and form",
  helpLabel: "How we can help",
  details: {
    email: "Email",
    phone: "Phone",
    hours: "Customer Care Hours",
    /** PLACEHOLDER hours until the company confirms them. */
    hoursLines: ["Business days", "9:00 AM–6:00 PM"],
  },
  help: [
    { title: "Order Support", text: "Shipping, returns and order questions." },
    {
      title: "Fragrance Guidance",
      text: "Need help choosing the right scent?",
    },
    {
      title: "General Enquiries",
      text: "Brand, collaboration and other questions.",
    },
  ],
  form: {
    fullName: "Full Name",
    email: "Email Address",
    phone: "Phone Number",
    subject: "Subject",
    message: "Message",
    submit: "Send Message",
  },
  /** Subjects prefilled by /contact?topic=… links. */
  topics: {
    wholesale: "Wholesale inquiry",
    "track-order": "Order tracking",
  },
  /** Shown above the form for a topic that needs a hint; there is no online tracking. */
  topicNotes: {
    trackOrder:
      "To ask about an order, please include your order reference in your message so our team can find it quickly.",
  },
  status: {
    invalid: "Please check the highlighted fields.",
    unavailable:
      "Contact submission is not available yet. Your message has not been sent.",
    success: "Thank you. Your message has been sent.",
  },
}
