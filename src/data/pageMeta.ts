import type { PageSeo } from "../lib/seo";

type Meta = Pick<PageSeo, "title" | "description" | "path" | "absoluteTitle"> & { crumb?: string };

/** Titles: ≤60 chars including " | SellSharp". Descriptions: 70–160 chars. Enforced by pageMeta.test.ts. */
export const PAGE_META = {
  home: {

    title: "SellSharp – Create Your Online Store in Nigeria",
    absoluteTitle: true,
    description:
      "Create your online store, manage products, receive orders and accept online payments with SellSharp. Start selling your products online in Nigeria.",

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

    description: "Your SellSharp dashboard: sales today, pending orders, who owes you, low stock and shortcuts to record a sale or share your store.",
    path: "/dashboard",
  },
  dashboardSeo: {
    title: "Store SEO settings",
    description:
      "Control how your SellSharp store appears in Google search results and when your link is shared on WhatsApp.",
    path: "/dashboard/seo",
  },
  dashboardSale: {
    title: "Record a sale",
    description: "Record a sale from WhatsApp, Instagram, a phone call or a walk-in customer, with the amount paid and the balance worked out for you.",
    path: "/dashboard/sale",
  },
  dashboardOrders: {
    title: "Orders",
    description: "See and manage your SellSharp orders: confirm, update the status, record payments and print receipts for your customers.",
    path: "/dashboard/orders",
  },
  dashboardCustomers: {
    title: "Customers and debts",
    description: "Your customer list with purchase history, what each customer has paid and who still owes you money, in your SellSharp dashboard.",
    path: "/dashboard/customers",
  },
  dashboardProducts: {
    title: "Products",
    description: "Add and edit the products in your SellSharp store: prices, pictures, stock, hiding, duplicating and sharing on WhatsApp.",
    path: "/dashboard/products",
  },
  dashboardReceipt: {
    title: "Receipt",
    description: "Preview, print or share a customer receipt from your SellSharp dashboard. Updated receipts keep the original history.",
    path: "/dashboard/receipt",

  },
  notFound: {
    title: "Page not found",
    description: "The page you're looking for doesn't exist or may have moved.",
    path: "/404",
  },
} satisfies Record<string, Meta>;
