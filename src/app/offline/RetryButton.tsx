"use client";

import { RotateCw } from "lucide-react";

export function RetryButton() {
  return (
    <button type="button" onClick={() => window.location.reload()} className="btn btn-primary">
      <RotateCw className="h-4 w-4" /> ลองใหม่
    </button>
  );
}
