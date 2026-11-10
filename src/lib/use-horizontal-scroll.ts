"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseHorizontalScrollOptions {
  wheelSpeed?: number;
  dragSpeed?: number;
  dragThreshold?: number;
}

export function useHorizontalScroll<T extends HTMLElement = HTMLDivElement>(
  options: UseHorizontalScrollOptions = {}
) {
  const { wheelSpeed = 1, dragSpeed = 1.1, dragThreshold = 3 } = options;
  const [element, setElement] = useState<T | null>(null);
  const elementRef = useRef<T | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Callback ref guarantees attachment even when element is conditionally mounted/unmounted
  const ref = useCallback((node: T | null) => {
    elementRef.current = node;
    setElement(node);
  }, []);

  // Update bounds
  const updateScrollBounds = useCallback(() => {
    const el = elementRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  const scrollByAmount = useCallback((amount: number) => {
    const el = elementRef.current;
    if (!el) return;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = element;
    if (!el) return;

    // Initial check
    updateScrollBounds();

    // 1) Wheel handling: translate wheel deltaY/deltaX to horizontal scrollLeft
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;

      const absY = Math.abs(e.deltaY);
      const absX = Math.abs(e.deltaX);
      const delta = (absY >= absX ? e.deltaY : e.deltaX) * wheelSpeed;
      if (delta === 0) return;

      e.preventDefault();
      e.stopPropagation();
      el.scrollLeft += delta;
      updateScrollBounds();
    };

    // 2) Mouse Click-and-Drag handling
    let isDown = false;
    let startX = 0;
    let initialScrollLeft = 0;
    let hasMoved = false;
    let suppressClick = false;
    let suppressTimer: ReturnType<typeof setTimeout> | null = null;

    const onMouseDown = (e: MouseEvent) => {
      // Primary left click only
      if (e.button !== 0) return;
      isDown = true;
      hasMoved = false;
      startX = e.clientX;
      initialScrollLeft = el.scrollLeft;
      el.style.cursor = "grabbing";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      const dx = (e.clientX - startX) * dragSpeed;
      if (Math.abs(dx) > dragThreshold) {
        hasMoved = true;
        suppressClick = true;
      }
      if (hasMoved) {
        e.preventDefault();
        el.scrollLeft = initialScrollLeft - dx;
        updateScrollBounds();
      }
    };

    const onMouseUp = () => {
      if (!isDown) return;
      isDown = false;
      el.style.cursor = "grab";

      if (hasMoved) {
        if (suppressTimer) clearTimeout(suppressTimer);
        suppressTimer = setTimeout(() => {
          suppressClick = false;
          hasMoved = false;
        }, 80);
      }
    };

    // Intercept click in capture phase if user dragged
    const onClickCapture = (e: MouseEvent) => {
      if (suppressClick || hasMoved) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    const onScroll = () => {
      updateScrollBounds();
    };

    const onDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    el.style.cursor = "grab";

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("click", onClickCapture, true);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("blur", onMouseUp);

    const ro = new ResizeObserver(() => {
      updateScrollBounds();
    });
    ro.observe(el);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("dragstart", onDragStart);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("click", onClickCapture, true);

      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", onMouseUp);

      ro.disconnect();
      if (suppressTimer) clearTimeout(suppressTimer);
    };
  }, [element, wheelSpeed, dragSpeed, dragThreshold, updateScrollBounds]);

  return {
    ref,
    canScrollLeft,
    canScrollRight,
    scrollBy: scrollByAmount,
    updateScrollBounds,
  };
}
