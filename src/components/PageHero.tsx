import type { ReactNode } from "react";

export function PageHero({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body: string }) {
  return (
    <section className="page-hero">
      <div className="container">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </section>
  );
}
