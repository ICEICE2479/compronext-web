"use client";

import { useEffect, useState } from "react";

export interface ShippingRule {
  fee: number;
  freeMin: number | null;
}

let cache: Record<string, ShippingRule> | null = null;
let pending: Promise<Record<string, ShippingRule>> | null = null;

function load() {
  pending ??= fetch("/api/shipping")
    .then((r) => r.json())
    .then((d) => (cache = (d?.rules as Record<string, ShippingRule>) ?? {}))
    .catch(() => (cache = {}));
  return pending;
}

/** กฎค่าส่งของร้านพาร์ตเนอร์ (โหลดครั้งเดียวต่อหน้า) */
export function useShippingRules() {
  const [rules, setRules] = useState(cache);
  useEffect(() => {
    if (!cache) load().then(setRules);
  }, []);
  return rules;
}

/** ค่าส่งของร้านนี้ — null = ร้านไม่ได้ระบุ (ดูที่ร้าน) */
export function shippingFor(rule: ShippingRule | undefined, subtotal: number): number | null {
  if (!rule) return null;
  if (rule.freeMin !== null && subtotal >= rule.freeMin) return 0;
  return rule.fee;
}
