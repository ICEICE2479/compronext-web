"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes, type SyntheticEvent } from "react";

type FadeImgProps = ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean };

/** <img> ที่จางเข้าเมื่อโหลดเสร็จ (คลาส .img-fade) — ผู้เรียกต้องให้ width/height หรือ aspect-ratio */
export default function FadeImg({ alt = "", priority, className, onLoad, onError, loading, decoding, ...rest }: FadeImgProps) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // รูปที่โหลดเสร็จก่อน hydrate จะไม่ยิง onLoad อีก
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) {
      const id = requestAnimationFrame(() => setLoaded(true));
      return () => cancelAnimationFrame(id);
    }
  }, [rest.src]);

  const handleLoad = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    setLoaded(true);
    onLoad?.(e);
  };
  // รูปเสีย: แสดงพื้นหลังแทน ไม่ค้างโปร่งใส
  const handleError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    setLoaded(true);
    onError?.(e);
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      alt={alt}
      {...rest}
      className={className ? `img-fade ${className}` : "img-fade"}
      data-loaded={loaded ? "true" : undefined}
      loading={priority ? "eager" : (loading ?? "lazy")}
      decoding={decoding ?? "async"}
      fetchPriority={priority ? "high" : rest.fetchPriority}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
