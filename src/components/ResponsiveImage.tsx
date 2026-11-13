import type { CSSProperties } from "react";

/**
 * Images always carry width/height (no layout shift), descriptive alt text, lazy loading, and an explicit priority for
 * the one image that is the page's main content (the LCP image).
 */
export function ResponsiveImage({
  src,
  alt,
  width = 1200,
  height = 800,
  priority = false,
  sizes,
  className,
}: {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const w = width ?? 1200;
  const h = height ?? 800;
  const style: CSSProperties = { aspectRatio: `${w} / ${h}`, width: "100%", height: "auto" };
  // React 18 forwards unknown lowercase attributes, so the standard `fetchpriority` hint works.
  const hint = priority ? ({ fetchpriority: "high" } as Record<string, string>) : {};
  return (
    <img
      src={src}
      alt={alt}
      width={w}
      height={h}
      sizes={sizes}
      className={className}
      style={style}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...hint}
    />
  );
}
