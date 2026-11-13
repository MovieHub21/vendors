import { useRef, useState } from "react";
import { ResponsiveImage } from "../../components/ResponsiveImage";
import type { Product } from "../../types/store";

/** Swipeable product photos with a count on phones and selectable thumbnails on larger screens. */
export function ProductGallery({ images, name }: { images: Product["images"]; name: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return <div className="sf-gallery"><span className="sf-img sf-img-0 sf-img-large" aria-hidden="true" /></div>;
  }

  function goTo(index: number) {
    const element = track.current;
    if (element) element.scrollTo({ left: index * element.clientWidth, behavior: "smooth" });
  }

  function updateActive() {
    const element = track.current;
    if (element?.clientWidth) setActive(Math.round(element.scrollLeft / element.clientWidth));
  }

  return (
    <div className="sf-gallery">
      <div className="sf-gallery-stage">
        <ul ref={track} className="sf-gallery-track" onScroll={updateActive} aria-label={`${name} photos`}>
          {images.map((image, index) => (
            <li key={image.url}>
              <ResponsiveImage
                src={image.url}
                alt={image.alt || (index === 0 ? name : `${name} – photo ${index + 1}`)}
                width={image.width}
                height={image.height}
                priority={index === 0}
                sizes="(max-width: 760px) 100vw, 50vw"
              />
            </li>
          ))}
        </ul>
        {images.length > 1 && <span className="sf-gallery-count" aria-hidden="true">{active + 1} / {images.length}</span>}
      </div>
      {images.length > 1 && <>
        <div className="sf-gallery-dots" aria-hidden="true">
          {images.map((image, index) => <span key={image.url} className={active === index ? "is-active" : undefined} />)}
        </div>
        <ul className="sf-thumbs" aria-label="Choose a product photo">
          {images.map((image, index) => (
            <li key={image.url}>
              <button type="button" className={active === index ? "is-active" : undefined} aria-label={`Show photo ${index + 1}`} aria-pressed={active === index} onClick={() => goTo(index)}>
                <img src={image.url} alt="" width={96} height={96} loading="lazy" decoding="async" />
              </button>
            </li>
          ))}
        </ul>
      </>}
    </div>
  );
}
