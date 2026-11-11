/** All money in the app is stored as integer kobo (₦1 = 100 kobo). Convert only for display. */
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
const nairaWithKobo = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2 });

export function formatNaira(kobo: number): string {
  return Number.isInteger(kobo / 100) ? naira.format(kobo / 100) : nairaWithKobo.format(kobo / 100);
}

/** Plain decimal string for structured data, e.g. 4500000 -> "45000.00". */
export function koboToDecimalString(kobo: number): string {
  return (kobo / 100).toFixed(2);
}
