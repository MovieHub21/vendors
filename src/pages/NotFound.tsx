import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Seo } from "../components/Seo";
import { PAGE_META } from "../data/pageMeta";

export default function NotFound() {
  return (
    <>
      <Seo seo={{ ...PAGE_META.notFound, noindex: true }} />
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">404 — PAGE NOT FOUND</span>
          <h1>
            That page took
            <br />
            <em>a wrong turn.</em>
          </h1>
          <p>The page you're looking for doesn't exist or may have moved.</p>
          <Link to="/" className="btn btn-primary">
            Back to homepage <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
