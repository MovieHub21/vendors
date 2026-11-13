import { createContext } from "react";
import type { PageData } from "./pageData";

/** Data the server already fetched for the current URL (injected into the HTML, so the browser can hydrate without refetching). */
export interface PreloadedPage {
  path: string;
  search: string;
  status: number;
  data: PageData;
}
export const PreloadedPageContext = createContext<PreloadedPage | null>(null);
