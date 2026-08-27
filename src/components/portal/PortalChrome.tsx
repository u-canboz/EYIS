import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Customer portal presentation layer.
 *
 * Deliberately different from the backoffice: calm, spacious, service oriented.
 * No sidebar, no dense tables, no data-grid chrome — large status, few actions.
 */

export function PortalPage({
  children,
  back,
  className,
}: {
  children: ReactNode;
  back?: { to: string; label: string } | undefined;
  className?: string | undefined;
}) {
  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="border-b border-border/60 bg-background">
        <nav
          aria-label="Kundenkonto"
          className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-2"
        >
          <Link
            to="/portal"
            className="-ml-2 flex min-h-11 min-w-0 items-center rounded-lg px-2 font-display text-sm font-semibold"
          >
            <span className="min-w-0 truncate">Kundenkonto</span>
          </Link>
          <span className="min-w-0 shrink truncate text-right text-xs text-muted-foreground">
            Service &amp; Bestellungen
          </span>
        </nav>
      </div>

      <main className={cn("mx-auto w-full max-w-2xl px-5 pt-6 pb-16 pb-safe", className)}>
        {back ? (
          <Link
            to={back.to}
            className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{back.label}</span>
          </Link>
        ) : null}
        {children}
      </main>
    </div>
  );
}

/** Large, reassuring page opener. */
export function PortalHeading({
  title,
  description,
  className,
}: {
  title: string;
  description?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <header className={cn("mb-7 min-w-0", className)}>
      <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight break-words text-balance sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-prose text-sm break-words text-pretty text-muted-foreground">
          {description}
        </p>
      ) : null}
    </header>
  );
}

/** Soft content block. Rounded, low contrast, generous padding. */
export function PortalCard({
  title,
  description,
  children,
  className,
  action,
}: {
  title?: ReactNode | undefined;
  description?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <section
      className={cn("min-w-0 rounded-2xl border border-border/70 bg-background p-5", className)}
    >
      {title ? (
        <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold tracking-tight break-words">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm break-words text-pretty text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Prominent status band shown at the top of an order. */
export function PortalStatus({
  headline,
  detail,
  tone = "neutral",
}: {
  headline: string;
  detail?: ReactNode | undefined;
  tone?: "neutral" | "positive" | "attention" | undefined;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border p-5",
        tone === "positive" && "border-primary/30 bg-primary/5",
        tone === "attention" && "border-destructive/30 bg-destructive/5",
        tone === "neutral" && "border-border/70 bg-background",
      )}
    >
      <p className="font-display text-lg leading-snug font-semibold break-words text-balance">
        {headline}
      </p>
      {detail ? (
        <p className="mt-1 text-sm break-words text-pretty text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

/** Label/value line. Amounts stay tabular and never truncate. */
export function PortalRow({
  label,
  value,
  strong,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean | undefined;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 py-1.5 text-sm">
      <dt className="min-w-0 break-words text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-right break-words tabular-nums",
          strong ? "text-base font-semibold" : "font-medium",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export type PortalTimelineEntry = { title: string; meta?: ReactNode; done?: boolean };

/** Shipment / order progress. Reads top-down, newest first. */
export function PortalTimeline({ entries }: { entries: PortalTimelineEntry[] }) {
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground">Noch keine Ereignisse vorhanden.</p>;
  }
  return (
    <ol className="min-w-0 space-y-4">
      {entries.map((e, i) => (
        <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <div className="flex flex-col items-center">
            {e.done ? (
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            {i < entries.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-sm font-medium break-words text-pretty">{e.title}</p>
            {e.meta ? <p className="mt-0.5 text-xs break-words text-muted-foreground">{e.meta}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
