import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
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
  aside?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 items-start gap-4",
        aside && "lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-4">{main}</div>
      {aside ? <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20">{aside}</div> : null}
    </div>
  );
}

/**
 * Panel used across detail pages. On mobile the sections run edge to edge and
 * connect visually into one work surface; from `sm` they become cards with a
 * single hairline border and no shadow.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode | undefined;
  description?: ReactNode | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  bodyClassName?: string | undefined;
}) {
  return (
    <section
      className={cn(
        "-mx-4 min-w-0 border-y border-border bg-card sm:mx-0 sm:rounded-xl sm:border",
        className,
      )}
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

/**
 * Contextual jump-off links for a detail record ("was kann ich von hier aus tun").
 * Purely navigational — no data logic.
 */
export function RelatedLinks({
  title = "Weiter im Prozess",
  items,
}: {
  title?: string;
  items: { to: string; params?: Record<string, string>; label: string; hint?: string; icon: LucideIcon }[];
}) {
  return (
    <Panel title={title} bodyClassName="p-2">
      <ul className="min-w-0">
        {items.map((item) => (
          <li key={item.label} className="min-w-0">
            <Link
              to={item.to}
              {...(item.params ? { params: item.params } : {})}
              className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
            >
              <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.label}</span>
                {item.hint ? (
                  <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
                ) : null}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
