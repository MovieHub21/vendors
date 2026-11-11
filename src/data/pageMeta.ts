import type { PageSeo } from "../lib/seo";

type Meta = Pick<PageSeo, "title" | "description" | "path" | "absoluteTitle"> & { crumb?: string };

/** Titles: ≤60 chars including " | SellSharp". Descriptions: 70–160 chars. Enforced by pageMeta.test.ts. */
export const PAGE_META = {
  home: {
    title: "SellSharp: Online Store & Orders for Nigerian Vendors",
    absoluteTitle: true,
    description:
      "SellSharp gives Nigerian WhatsApp vendors a shareable online store, order dashboard, receipts and debt tracker. Plans from ₦3,000 a month.",
    path: "/",
  },
  features: {
    title: "Store, Orders, Receipts & Debt Tracker",
    description:
      "See what SellSharp does: your own storefront link, order management, customer records, receipts, debt tracking and a simple sales overview.",
    path: "/features",
    crumb: "Features",
  },
  pricing: {
    title: "Pricing: ₦3,000/month, Everything Included",
    description:
      "One simple SellSharp plan at ₦3,000 per month: storefront, orders, customer records, receipts, debt tracking and WhatsApp sharing tools.",
    path: "/pricing",
    crumb: "Pricing",
  },
  faq: {
    title: "FAQs: Orders, Payments & Your Store Link",
    description:
      "Answers to common questions about SellSharp: store links, customer checkout, Paystack payments, debt tracking and using it on your phone.",
    path: "/faq",
    crumb: "FAQs",
  },
  contact: {
    title: "Contact SellSharp",
    description:
      "Questions about setting up your store, pricing or payments? Send the SellSharp team a message and tell us what you need help with.",
    path: "/contact",
    crumb: "Contact",
  },
  about: {
    title: "About us",
    description:
      "SellSharp is being built to make the everyday work behind small Nigerian online businesses simpler, calmer and better organised.",
    path: "/about",
    crumb: "About",
  },
  terms: {
    title: "Terms of Service",
    description:
      "A draft preview of the terms that will govern use of the SellSharp platform by vendors and their customers.",
    path: "/terms",
    crumb: "Terms of Service",
  },
  privacy: {
    title: "Privacy Policy",
    description: "A plain-language draft of how SellSharp intends to handle account, order and payment information.",
    path: "/privacy",
    crumb: "Privacy Policy",
  },
  login: {
    title: "Log in",
    description: "Log in to your SellSharp account to manage your store, orders, customers and receipts.",
    path: "/login",
  },
  signup: {
    title: "Create your store",
    description: "Create your SellSharp account and set up your online store link in a few minutes.",
    path: "/signup",
  },
  forgotPassword: {
    title: "Reset your password",
    description: "Enter your email and we'll send you a link to reset your SellSharp password.",
    path: "/forgot-password",
  },
  resetPassword: {
    title: "Choose a new password",
    description: "Choose a new password for your SellSharp account to get back to your store.",
    path: "/reset-password",
  },
  onboarding: {
    title: "Set up your store",
    description: "Set up your store name, username and subscription to start selling on SellSharp.",
    path: "/onboarding",
  },
  onboardingPayment: {
    title: "Confirming your payment",
    description: "We're confirming your SellSharp subscription payment with Paystack. This takes a few seconds.",
    path: "/onboarding/payment",
  },
  dashboard: {
    title: "Dashboard",
    description: "Your SellSharp dashboard: store link, subscription status and your business overview.",
    path: "/app",
  },
  notFound: {
    title: "Page not found",
    description: "The page you're looking for doesn't exist or may have moved.",
    path: "/404",
  },
} satisfies Record<string, Meta>;
