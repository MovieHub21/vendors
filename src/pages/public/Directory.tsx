import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";import { Seo } from "../../components/Seo";
import { directoryPath, storePath } from "../../lib/routes";
import { buildDirectorySeo, storeLocation } from "../../lib/seo";
import { SITE } from "../../lib/site";
import type { DirectoryScope } from "../../ssr/pageData";
import type { DirectoryFacet, VendorStore } from "../../types/store";

function FacetGroup({ heading, defaultOpen, children }: { heading: string; defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="dir-facet-group">
      <button
        type="button"
        className="dir-facet-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {heading}
        <span className="dir-facet-chevron" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="dir-facet-body">{children}</div>}
    </div>
  );
}

export function Directory({
  scope,
  stores,
  facets,
  q,
  indexable,
}: {
  scope: DirectoryScope;
  stores: VendorStore[];
  facets: DirectoryFacet[];
  q: string;
  indexable: boolean;
}) {
  const facet = scope.type === "facet" ? scope.facet : null;
  const where =
    facet?.kind === "category"
      ? `${facet.name} stores`
      : facet
        ? `Online stores in ${facet.name}`
        : "Online stores in Nigeria";
  const description = facet
    ? `Discover ${stores.length} ${facet.kind === "category" ? facet.name.toLowerCase() : `online`} store${stores.length === 1 ? "" : "s"}${facet.kind === "category" ? " in Nigeria" : ` in ${facet.name}`} on ${SITE.name}. Browse products and order online.`
    : `Browse Nigerian vendors on ${SITE.name}. Find stores by category or location, explore their products and order online.`;
  const path = directoryPath(facet?.slug);
  const categories = facets.filter((f) => f.kind === "category");
  const locations = facets.filter((f) => f.kind !== "category");

  return (
    <>
      <Seo
        seo={buildDirectorySeo({
          path,
          heading: facet ? where : "Browse Online Stores in Nigeria",
          description,
          stores,
          indexable,
          crumbs: facet
            ? [
                { name: "Stores", path: directoryPath() },
                { name: where, path },
              ]
            : [{ name: "Stores", path: directoryPath() }],
        })}
      />
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">STORE DIRECTORY</span>
          <h1>{facet ? where : "Browse online stores in Nigeria"}</h1>
          <p>{description}</p>
          <form method="get" action="/stores" role="search" className="dir-search">
            <label htmlFor="dir-q" className="sr-only">
              Search stores by name
            </label>
            <input
              id="dir-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search stores by name"
              maxLength={40}
            />
            <button className="btn btn-primary" type="submit">
              Search
            </button>
          </form>
        </div>
      </section>
      <section className="section section-white">
        <div className="container">
          {(categories.length > 0 || locations.length > 0) && (
            <nav aria-label="Browse by category and location" className="dir-facets">
              {categories.length > 0 && (
                <FacetGroup
                  heading="Categories"
                  defaultOpen={facet?.kind === "category"}
                >
                  <ul className="chips">
                    <li>
                      <Link
                        to={directoryPath()}
                        aria-current={scope.type === "all" ? "page" : undefined}
                        className={scope.type === "all" ? "chip-all-active" : ""}
                      >
                        All stores
                      </Link>
                    </li>
                    {categories.map((c) => (
                      <li key={c.slug}>
                        <Link to={directoryPath(c.slug)} aria-current={facet?.slug === c.slug ? "page" : undefined}>
                          {c.name} ({c.storeCount})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </FacetGroup>
              )}
              {locations.length > 0 && (
                <FacetGroup
                  heading="Locations"
                  defaultOpen={facet?.kind !== "category" && !!facet}
                >
                  <ul className="chips">
                    {locations.map((l) => (
                      <li key={`${l.kind}-${l.slug}`}>
                        <Link to={directoryPath(l.slug)} aria-current={facet?.slug === l.slug ? "page" : undefined}>
                          {l.name} ({l.storeCount})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </FacetGroup>
              )}
            </nav>
          )}
          {stores.length === 0 ? (
            <p className="sf-empty">{q ? `No stores match “${q}”.` : "No stores to show here yet."}</p>
          ) : (
            <ul className="dir-grid">
              {stores.map((s) => (
                <li key={s.id}>
                  <Link to={storePath(s.slug)} className="dir-card">
                    <div className="dir-card-header">
                      <strong>{s.name}</strong>
                      {s.isDemo && <span className="dir-demo-pill">Sample</span>}
                    </div>
                    {s.tagline && <span>{s.tagline}</span>}
                    <small>
                      {s.category} · {storeLocation(s)}
                    </small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
