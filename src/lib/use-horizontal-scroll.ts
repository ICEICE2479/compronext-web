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
  const { wheelSpeed = 1.2, dragSpeed = 1, dragThreshold = 4 } = options;
  const elRef = useRef<T | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll bounds
  const updateScrollBounds = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  const scrollByAmount = useCallback((amount: number) => {
    const el = elRef.current;
    if (!el) return;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    // Check initial bounds
    updateScrollBounds();

    // 1) Wheel handling
    const onWheel = (e: WheelEvent) => {
      const absY = Math.abs(e.deltaY);
      const absX = Math.abs(e.deltaX);
      const delta = (absY >= absX ? e.deltaY : e.deltaX) * wheelSpeed;
      if (delta === 0) return;

      const canLeft = el.scrollLeft > 0;
      const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;

      // Only prevent default and scroll horizontally if scrollable
      if ((delta > 0 && canRight) || (delta < 0 && canLeft)) {
        e.preventDefault();
        e.stopPropagation();
        el.scrollLeft += delta;
        updateScrollBounds();
      }
    };

    // 2) Mouse Click-and-Drag handling
    let isDown = false;
    let startX = 0;
    let initialScrollLeft = 0;
    let isDragging = false;
    let dragSuppressTimeout: ReturnType<typeof setTimeout> | null = null;

    const onMouseDown = (e: MouseEvent) => {
      // Primary (left) click only
      if (e.button !== 0) return;
      isDown = true;
      isDragging = false;
      startX = e.clientX;
      initialScrollLeft = el.scrollLeft;
      el.style.cursor = "grabbing";
      el.style.userSelect = "none";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      const dx = (e.clientX - startX) * dragSpeed;
      if (Math.abs(dx) > dragThreshold) {
        isDragging = true;
      }
      if (isDragging) {
        e.preventDefault();
        el.scrollLeft = initialScrollLeft - dx;
        updateScrollBounds();
      }
    };

    const onMouseUp = () => {
      if (!isDown) return;
      isDown = false;
      el.style.cursor = "grab";
      el.style.removeProperty("user-select");

      if (isDragging) {
        // Keep isDragging active briefly so any click event triggered this frame is cancelled
        if (dragSuppressTimeout) clearTimeout(dragSuppressTimeout);
        dragSuppressTimeout = setTimeout(() => {
          isDragging = false;
        }, 80);
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      if (isDragging) {
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

    // Set initial cursor
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
      if (dragSuppressTimeout) clearTimeout(dragSuppressTimeout);
    };
  }, [wheelSpeed, dragSpeed, dragThreshold, updateScrollBounds]);

  return {
    ref: elRef,
    canScrollLeft,
    canScrollRight,
    scrollBy: scrollByAmount,
    updateScrollBounds,
  };
}
