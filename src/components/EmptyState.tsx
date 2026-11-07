import Link from "next/link";
import type React from "react";
import { AlertTriangle, Inbox } from "lucide-react";

export default function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "empty",
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  tone?: "empty" | "error";
  className?: string;
}) {
  const isError = tone === "error";
  const cls = `${isError ? "error-state" : "empty-state"}${className ? ` ${className}` : ""}`;
  return (
    <div className={cls} role={isError ? "alert" : undefined}>
      <span className="empty-state-icon" aria-hidden="true">
        {icon ?? (isError ? <AlertTriangle size={26} /> : <Inbox size={26} />)}
      </span>
      <h2 className="empty-state-title">{title}</h2>
      {description && <p className="empty-state-text">{description}</p>}
      {action &&
        (action.href ? (
          <Link href={action.href} onClick={action.onClick} className="btn btn-primary mt-2 min-h-11">
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="btn btn-primary mt-2 min-h-11">
            {action.label}
          </button>
        ))}
    </div>
  );
}
