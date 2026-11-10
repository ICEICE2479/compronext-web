"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseHorizontalScrollOptions {
  wheelSpeed?: number;
  friction?: number; // 0.78 - 0.82 for fast, crisp stopping on drag release
  springDamping?: number; // 0.38 - 0.42 for snappy, responsive, smooth wheel gliding
}

export function useHorizontalScroll<T extends HTMLElement = HTMLDivElement>(
  options: UseHorizontalScrollOptions = {}
) {
  const { wheelSpeed = 1, friction = 0.8, springDamping = 0.4 } = options;
  const [element, setElement] = useState<T | null>(null);
  const elementRef = useRef<T | null>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Use refs to avoid re-rendering parent components when values haven't changed
  const canLeftRef = useRef(false);
  const canRightRef = useRef(false);

  // Animation frame and target refs
  const targetScrollLeftRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Callback ref guarantees attachment even when element is conditionally mounted/unmounted
  const ref = useCallback((node: T | null) => {
    elementRef.current = node;
    setElement(node);
  }, []);

  // Update bounds with guard to prevent React render loops
  const updateScrollBounds = useCallback(() => {
    const el = elementRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const nextLeft = scrollLeft > 2;
    const nextRight = scrollLeft < scrollWidth - clientWidth - 2;

    if (nextLeft !== canLeftRef.current) {
      canLeftRef.current = nextLeft;
      setCanScrollLeft(nextLeft);
    }
    if (nextRight !== canRightRef.current) {
      canRightRef.current = nextRight;
      setCanScrollRight(nextRight);
    }
  }, []);

  // Smooth lerp scrolling helper (for buttons and wheel)
  const smoothScrollTo = useCallback(
    (target: number) => {
      const el = elementRef.current;
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const clamped = Math.max(0, Math.min(target, maxScroll));
      targetScrollLeftRef.current = clamped;

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

      const step = () => {
        const current = el.scrollLeft;
        const targetVal = targetScrollLeftRef.current;
        if (targetVal === null) return;

        const diff = targetVal - current;
        if (Math.abs(diff) < 0.6) {
          el.scrollLeft = targetVal;
          targetScrollLeftRef.current = null;
          updateScrollBounds();
          return;
        }

        el.scrollLeft = current + diff * springDamping;
        updateScrollBounds();
        rafIdRef.current = requestAnimationFrame(step);
      };

      rafIdRef.current = requestAnimationFrame(step);
    },
    [springDamping, updateScrollBounds]
  );

  const scrollByAmount = useCallback(
    (amount: number) => {
      const el = elementRef.current;
      if (!el) return;
      const current = targetScrollLeftRef.current ?? el.scrollLeft;
      smoothScrollTo(current + amount);
    },
    [smoothScrollTo]
  );

  useEffect(() => {
    const el = element;
    if (!el) return;

    // Enforce instant direct scroll behavior on element
    el.style.scrollBehavior = "auto";

    // Initial check
    updateScrollBounds();

    // 1) Fast, Snappy, Smooth Wheel with Spring Lerp (No sluggish delay)
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;

      const absY = Math.abs(e.deltaY);
      const absX = Math.abs(e.deltaX);
      const delta = (absY >= absX ? e.deltaY : e.deltaX) * wheelSpeed;
      if (delta === 0) return;

      e.preventDefault();
      e.stopPropagation();

      const current = targetScrollLeftRef.current ?? el.scrollLeft;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const nextTarget = Math.max(0, Math.min(current + delta, maxScroll));
      targetScrollLeftRef.current = nextTarget;

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

      const loop = () => {
        const cur = el.scrollLeft;
        const tgt = targetScrollLeftRef.current;
        if (tgt === null) return;

        const diff = tgt - cur;
        if (Math.abs(diff) < 0.5) {
          el.scrollLeft = tgt;
          targetScrollLeftRef.current = null;
          updateScrollBounds();
          return;
        }

        // Fast spring lerp: 40% per frame reaches destination cleanly in ~80-100ms
        el.scrollLeft = cur + diff * springDamping;
        updateScrollBounds();
        rafIdRef.current = requestAnimationFrame(loop);
      };

      rafIdRef.current = requestAnimationFrame(loop);
    };

    // 2) Kinetic Mouse Drag with Instant 1:1 Tracking & Fast-Stopping Momentum
    let isDown = false;
    let startX = 0;
    let initialScroll = 0;
    let hasMoved = false;
    let suppressClick = false;
    let suppressTimer: ReturnType<typeof setTimeout> | null = null;

    let lastTime = 0;
    let lastClientX = 0;
    let velocity = 0; // px / ms

    const onMouseDown = (e: MouseEvent) => {
      // Primary left click only
      if (e.button !== 0) return;

      // Stop any active smooth wheel or inertia coasting immediately
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      targetScrollLeftRef.current = null;

      isDown = true;
      hasMoved = false;
      startX = e.clientX;
      lastClientX = e.clientX;
      lastTime = performance.now();
      initialScroll = el.scrollLeft;
      velocity = 0;
      el.style.cursor = "grabbing";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      const now = performance.now();
      const dt = now - lastTime;
      const dx = e.clientX - startX;

      if (Math.abs(dx) > 3) {
        hasMoved = true;
        suppressClick = true;
      }

      if (hasMoved) {
        e.preventDefault();
        // 1:1 direct real-time movement (zero lag / zero delay)
        el.scrollLeft = initialScroll - dx;

        if (dt > 8) {
          const moveDelta = e.clientX - lastClientX;
          velocity = velocity * 0.3 + (moveDelta / dt) * 0.7;
          lastClientX = e.clientX;
          lastTime = now;
        }

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
        }, 100);

        // Fast-Stopping Kinetic Inertia Momentum
        const now = performance.now();
        // If user paused before releasing (> 60ms), stop immediately without gliding
        if (now - lastTime < 60 && Math.abs(velocity) > 0.15) {
          let currentVelocity = velocity * 14;
          const maxVelocity = 30; // Limit flick speed to prevent runaway sliding
          currentVelocity = Math.max(-maxVelocity, Math.min(maxVelocity, currentVelocity));

          const inertiaStep = () => {
            if (isDown) return;
            // Stop quickly when velocity decays
            if (Math.abs(currentVelocity) < 0.6) {
              updateScrollBounds();
              return;
            }

            el.scrollLeft -= currentVelocity;
            currentVelocity *= friction; // Fast friction braking (0.80)
            updateScrollBounds();
            rafIdRef.current = requestAnimationFrame(inertiaStep);
          };

          rafIdRef.current = requestAnimationFrame(inertiaStep);
        }
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
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
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
  }, [element, wheelSpeed, friction, springDamping, updateScrollBounds]);

  return {
    ref,
    canScrollLeft,
    canScrollRight,
    scrollBy: scrollByAmount,
    updateScrollBounds,
  };
}
