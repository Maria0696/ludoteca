"use client";

import { useState } from "react";

/**
 * Carátula 3:4. Si no hay imagen o no carga, el título ocupa su lugar sobre
 * cartón, así la rejilla nunca muestra un hueco ni un icono roto.
 */
export function Cover({
  src,
  title,
  caption,
  sizes,
  priority = false,
  className,
}: {
  src?: string | null;
  title: string;
  caption?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  return (
    <div className={["cover", className].filter(Boolean).join(" ")}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- carátulas externas sin pasar por la optimización de imágenes
        <img
          src={src}
          alt=""
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="cover-fallback" aria-hidden>
          <strong>{title}</strong>
          <span>{caption ?? "Sin carátula"}</span>
        </div>
      )}
    </div>
  );
}
