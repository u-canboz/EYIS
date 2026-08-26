import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Detail page workspace: stacked on mobile, composed two-column from `lg`.
 * The aside collapses below the main content instead of squeezing it.
 */
export function DetailLayout({
  main,
  aside,
  className,
}: {
  main: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 items-start gap-5",
        aside && "lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-5">{main}</div>
      {aside ? <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20">{aside}</div> : null}
    </div>
  );
}

/** Panel used across detail pages — replaces ad-hoc Card stacks. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn("min-w-0 rounded-xl border border-border bg-card shadow-raised", className)}
    >
      {title ? (
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-sm font-semibold tracking-tight">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("min-w-0 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Label/value row used in summary panels; wraps instead of truncating money. */
export function DataRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(6rem,40%)_minmax(0,1fr)] items-start gap-3 py-1.5 text-sm">
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Horizontally scrollable, touch-friendly tab strip container. */
export function ScrollTabs({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("scroll-x -mx-1 px-1 pb-1", className)}>
      <div className="flex min-w-max items-center gap-1">{children}</div>
    </div>
  );
}
