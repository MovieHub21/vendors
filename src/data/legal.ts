export type LegalSection = readonly [heading: string, body: string];

export const PRIVACY_SECTIONS: LegalSection[] = [
  [
    "Information you provide",
    "SellSharp may collect account details, business information, product listings, customer order details and support messages needed to provide the service.",
  ],
  [
    "How information is used",
    "Information is used to operate the platform, display vendor storefronts, process orders, provide support, maintain security and improve the service.",
  ],
  [
    "Payments",
    "Online payments are intended to be processed by Paystack. Sensitive card details should be handled by the payment provider, not stored by SellSharp.",
  ],
  [
    "Sharing and access",
    "A vendor should only have access to their own private business records. Customer-facing information should be limited to what is needed to place and track an order.",
  ],
  [
    "Security and retention",
    "We intend to use access controls and appropriate security measures to protect information. Final retention and deletion policies will be published before launch.",
  ],
  [
    "Your choices",
    "You should be able to request access to, correction of or deletion of personal information, subject to applicable legal requirements.",
  ],
];

export const TERMS_SECTIONS: LegalSection[] = [
  [
    "Using SellSharp",
    "SellSharp is intended to help vendors manage online storefronts, orders, customer records, receipts and business activity.",
  ],
  [
    "Vendor responsibilities",
    "Vendors are responsible for the accuracy of their listings, prices, stock information, fulfilment, customer communication and compliance with applicable laws.",
  ],
  [
    "Subscriptions",
    "The planned subscription is ₦3,000 per month. Billing, renewal, cancellation and access rules will be confirmed in the final subscription terms.",
  ],
  [
    "Orders and payments",
    "An order submission does not by itself prove payment. Payment status should only be updated after reliable payment confirmation.",
  ],
  [
    "Acceptable use",
    "Users must not misuse the platform, attempt to access another vendor's private information or upload unlawful or misleading content.",
  ],
  [
    "Changes and availability",
    "Features may change as the service develops. Any material changes to these terms will be communicated through the platform.",
  ],
];
