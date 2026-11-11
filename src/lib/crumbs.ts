import { SITE } from "./site";

/** Home > Page breadcrumb trail for a marketing page's metadata entry. */
export function crumbs(meta: { path: string; crumb?: string }) {
  return [
    { name: SITE.name, path: "/" },
    { name: meta.crumb ?? meta.path, path: meta.path },
  ];
}
