import { createDemoApi, createRestApi, type PublicApi } from "./publicApi";

let api: PublicApi | null = null;

/** Browser data source: the real public views when Supabase is configured, otherwise demo data for local development. */
export function getClientApi(): PublicApi {
  if (!api) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    api = url && key ? createRestApi({ url, key }) : createDemoApi();
  }
  return api;
}
