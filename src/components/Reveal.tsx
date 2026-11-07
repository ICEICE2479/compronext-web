"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type JSX,
  type ReactElement,
  type ReactNode,
} from "react";

/* IntersectionObserver ตัวเดียวใช้ร่วมกันทั้งหน้า */
type Callback = () => void;
const callbacks = new WeakMap<Element, Callback>();
let sharedObserver: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const cb = callbacks.get(entry.target);
          sharedObserver?.unobserve(entry.target);
          callbacks.delete(entry.target);
          cb?.();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );
  }
  return sharedObserver;
}

function shouldSkip(): boolean {
  return (
    typeof IntersectionObserver === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type RevealProps = {
  children?: ReactNode;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  /** ms */
  delay?: number;
  /** ms — หน่วงลูกตรงทีละตัว (--reveal-delay = delay + i*stagger) */
  stagger?: number;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/** ค่อยๆ โผล่ตอนเลื่อนถึง (ใช้คลาส .reveal / .is-visible ใน globals.css) */
export default function Reveal({ children, as = "div", className, delay = 0, stagger, ...a11y }: RevealProps): JSX.Element {
  const ref = useRef<Element | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => setVisible(true);
    if (shouldSkip()) {
      const id = requestAnimationFrame(show);
      return () => cancelAnimationFrame(id);
    }
    const io = getObserver();
    callbacks.set(el, show);
    io.observe(el);
    return () => {
      io.unobserve(el);
      callbacks.delete(el);
    };
  }, []);

  const Tag = as as ElementType;
  const vis = visible ? " is-visible" : "";

  if (stagger) {
    let i = 0;
    const items = Children.map(children, (child) => {
      if (!isValidElement<{ className?: string; style?: CSSProperties }>(child)) return child;
      const d = delay + i++ * stagger;
      const prev = child.props;
      return cloneElement(child as ReactElement<Record<string, unknown>>, {
        "data-reveal-child": "",
        className: `${prev.className ? `${prev.className} ` : ""}reveal${vis}`,
        style: { ...prev.style, "--reveal-delay": d } as CSSProperties,
      });
    });
    return (
      <Tag ref={ref} className={className} {...a11y}>
        {items}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref}
      {...a11y}
      className={`${className ? `${className} ` : ""}reveal${vis}`}
      style={delay ? ({ "--reveal-delay": delay } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
