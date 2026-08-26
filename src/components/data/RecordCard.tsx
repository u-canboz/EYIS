import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type RecordField = { label: string; value: ReactNode };

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned emphasis value, e.g. an amount. */
  trailing?: ReactNode;
  badges?: ReactNode;
  fields?: RecordField[];
  actions?: ReactNode;
  className?: string;
  interactive?: boolean;
};

/**
 * Mobile-first record card. Default representation for list data on narrow
 * viewports; tables stay reserved for dense desktop views.
 */
export function RecordCard({
  title,
  subtitle,
  trailing,
  badges,
  fields,
  actions,
  className,
  interactive,
}: Props) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border bg-card p-4 shadow-raised",
        interactive && "transition-colors hover:border-primary/50 hover:bg-accent/5",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {trailing ? <span className="font-medium tabular-nums">{trailing}</span> : null}
          {interactive ? (
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          ) : null}
        </div>
      </div>

      {badges ? <div className="mt-3 flex flex-wrap gap-1.5">{badges}</div> : null}

      {fields?.length ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {fields.map((f, i) => (
            <div key={i} className="min-w-0">
              <dt className="truncate text-muted-foreground">{f.label}</dt>
              <dd className="mt-0.5 min-w-0 break-words font-medium tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Card list container, shown where the table is hidden. */
export function RecordCardList({
  children,
  className,
  desktopHidden = true,
}: {
  children: ReactNode;
  className?: string;
  desktopHidden?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-3", desktopHidden && "lg:hidden", className)}>
      {children}
    </div>
  );
}
