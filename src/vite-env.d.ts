/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** Public origin of the site, no trailing slash. Used for canonical URLs, sitemap and social tags. */
  readonly VITE_SITE_URL?: string;
  /** Supabase project URL, e.g. https://abcd1234.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable key (sb_publishable_…) or the legacy anon key. Safe for the browser; never use the secret key here. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
