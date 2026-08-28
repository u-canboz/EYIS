import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

const TONES: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-info/25 bg-info/10 text-info",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/12 text-warning",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
  accent: "border-primary/25 bg-primary/10 text-primary",
};

/**
 * Single status vocabulary for the whole backoffice. Tone carries the meaning,
 * never a raw colour class in a page component.
 */
export function StatusBadge({
  tone = "neutral",
  children,
  dot = true,
  className,
}: {
  tone?: StatusTone | undefined;
  children: ReactNode;
  dot?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/** Compact metric tile for dashboards and system pages. */
export function MetricTile({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode | undefined;
  tone?: StatusTone | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-border bg-card p-4", className)}>
      <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display text-2xl leading-none font-semibold tabular-nums",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-destructive",
          tone === "accent" && "text-primary",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
