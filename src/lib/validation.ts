/** Form validation shared by the auth and onboarding screens. The server re-validates everything. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_MIN = 8;

export const validateEmail = (v: string): string | null =>
  !v.trim()
    ? "Enter your email address."
    : !EMAIL.test(v.trim())
      ? "That doesn't look like a valid email address."
      : null;

export function validatePassword(v: string): string | null {
  if (!v) return "Enter a password.";
  if (v.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "Include at least one letter and one number.";
  return null;
}

export const validateFullName = (v: string): string | null => {
  const n = v.trim();
  return n.length < 2 ? "Enter your full name." : n.length > 120 ? "That name is too long." : null;
};

export const validateStoreName = (v: string): string | null => {
  const n = v.trim();
  return n.length < 2 ? "Enter your business name." : n.length > 80 ? "Use 80 characters or fewer." : null;
};

/** Only same-site paths are allowed as a post-login destination, so a crafted ?next= can't send people elsewhere. */
export function safeNextPath(next: string | null | undefined, fallback = "/onboarding"): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    [...next].some((c) => c.charCodeAt(0) < 32)
  ) {
    return fallback;
  }
  return next;
}

export const SLUG_MESSAGES: Record<string, string> = {
  too_short: "Use at least 3 characters.",
  too_long: "Use 30 characters or fewer.",
  invalid_characters: "Use lowercase letters, numbers and single hyphens only.",
  reserved: "That name is reserved. Try another.",
  taken: "That username is already taken.",
};
<<<<<<< HEAD

/** Optional business phone. Accepts local (0803…) and international (+234…) formats. */
export const validatePhone = (v: string): string | null =>
  v.trim() === "" || /^\+?[0-9 ()-]{7,20}$/.test(v.trim()) ? null : "Enter a valid phone number, e.g. 0803 123 4567.";
=======
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
