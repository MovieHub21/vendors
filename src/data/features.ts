import {
  BarChart3,
  ClipboardList,
  FileText,
  MessageCircle,
  Package,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface Feature {
  icon: LucideIcon;
  title: string;
  text: string;
}

export const HOME_FEATURES: Feature[] = [
  {
    icon: ClipboardList,
    title: "Orders, organised",
    text: "Every order from your store lands in one clear dashboard. No more searching through old chats.",
  },
  {
    icon: Users,
    title: "Customers you know",
    text: "Keep customer details, purchase history and notes together, ready when you need them.",
  },
  {
    icon: FileText,
    title: "Receipts in seconds",
    text: "Create clean, branded receipts you can download, print or send straight to WhatsApp.",
  },
  {
    icon: Wallet,
    title: "Keep debts in sight",
    text: "Record part-payments, see who owes what and keep outstanding balances from slipping through.",
  },
  {
    icon: Store,
    title: "Your own online store",
    text: "Share one simple link where customers can browse your products and place orders.",
  },
  {
    icon: BarChart3,
    title: "Know your numbers",
    text: "See sales, order activity and your best-selling products without doing the maths by hand.",
  },
];

export const FEATURE_PAGE_ITEMS: Feature[] = [
  {
    icon: Store,
    title: "Your own storefront",
    text: "Give customers a link to browse your products, see prices and place orders. Your store carries your business name and identity.",
  },
  {
    icon: ClipboardList,
    title: "Order management",
    text: "Keep every order in one place. Review customer details, update order progress and find an order without digging through chats.",
  },
  {
    icon: Users,
    title: "Customer records",
    text: "Build a useful customer list with contact details, order history and notes, so repeat customers are easier to serve.",
  },
  {
    icon: FileText,
    title: "Receipts & records",
    text: "Create a receipt for an order, keep a record and share it with a customer. Make every transaction feel more professional.",
  },
  {
    icon: Wallet,
    title: "Debt tracking",
    text: "Record outstanding balances and partial payments. See what is still owed and keep payment history attached to the right customer.",
  },
  {
    icon: BarChart3,
    title: "Sales overview",
    text: "Understand how your store is doing with a clear view of orders, sales and product activity.",
  },
  {
    icon: Package,
    title: "Product catalogue",
    text: "Add product photos, descriptions, prices and availability so customers know what you have before they order.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp sharing",
    text: "Share your store link and send order or receipt details to customers through WhatsApp.",
  },
];

export const PRICING_INCLUDED = [
  "Your own online storefront and shareable link",
  "Product catalogue with photos and prices",
  "Order management and status updates",
  "Customer records and order history",
  "Branded receipts you can share",
  "Debt and partial-payment tracking",
  "Sales overview and basic reports",
  "WhatsApp sharing tools",
];
