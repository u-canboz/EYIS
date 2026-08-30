import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Native-feeling list container: divider-separated rows instead of a stack of
 * bordered cards. On wide viewports it sits inside a `SectionPanel`.
 */
export function RecordList({
  children,
  className,
  desktopHidden = false,
}: {
  children: ReactNode;
  className?: string | undefined;
  desktopHidden?: boolean | undefined;
}) {
  return (
    <ul
      className={cn(
        "min-w-0 divide-y divide-border",
        desktopHidden && "lg:hidden",
        className,
      )}
    >
      {children}
    </ul>
  );
}

export type RecordMeta = { label?: ReactNode | undefined; value: ReactNode };

type RowProps = {
  /** Thumbnail, avatar or icon. Kept small so rows stay 64–96 px tall. */
  leading?: ReactNode | undefined;
  title: ReactNode;
  /** One compact secondary line, e.g. "Heute, 08:34 · 2 Artikel". */
  subtitle?: ReactNode | undefined;
  /** Right-aligned emphasis value, usually an amount. */
  trailing?: ReactNode | undefined;
  /** Small caption under the trailing value. */
  trailingHint?: ReactNode | undefined;
  /** Max. two status chips. */
  badges?: ReactNode | undefined;
  /** Optional 2x2 meta grid for dense operational rows (inventory). */
  meta?: RecordMeta[] | undefined;
  /** Overflow / quick actions rendered at the right edge. */
  actions?: ReactNode | undefined;
  to?: string | undefined;
  params?: Record<string, string> | undefined;
  className?: string | undefined;
};

function RowBody({
  leading,
  title,
  subtitle,
  trailing,
  trailingHint,
  badges,
  meta,
  interactive,
}: RowProps & { interactive: boolean }) {
  return (
    <>
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : <span className="hidden" />}
        <div className="min-w-0">
          <div className="min-w-0 truncate text-sm font-medium">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 min-w-0 truncate text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
          {badges ? <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">{badges}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            {trailing ? (
              <div className="text-sm font-semibold tabular-nums">{trailing}</div>
            ) : null}
            {trailingHint ? (
              <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{trailingHint}</div>
            ) : null}
          </div>
          {interactive ? (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
          ) : null}
        </div>
      </div>
      {meta?.length ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          {meta.map((m, i) => (
            <div key={i} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
              <dt className="min-w-0 truncate text-muted-foreground">{m.label}</dt>
              <dd className="shrink-0 font-medium tabular-nums">{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
}

/**
 * Compact record row. Default representation for orders, products, customers
 * and inventory on every viewport width.
 */
export function RecordRow(props: RowProps) {
  const { to, params, actions, className } = props;
  const interactive = !!to;
  const padding = "px-4 py-3 sm:px-5";

  return (
    <li className={cn("min-w-0", className)}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center">
        {to ? (
          <Link
            to={to}
            {...(params ? { params } : {})}
            className={cn(
              "min-w-0 min-h-16 flex-col justify-center transition-colors hover:bg-muted/60",
              padding,
              "flex",
            )}
          >
            <RowBody {...props} interactive={!actions} />
          </Link>
        ) : (
          <div className={cn("flex min-h-16 min-w-0 flex-col justify-center", padding)}>
            <RowBody {...props} interactive={interactive} />
          </div>
        )}
        {actions ? <div className="shrink-0 pr-2 sm:pr-3">{actions}</div> : null}
      </div>
    </li>
  );
}

/** Square media slot used as `leading` in product/inventory rows. */
export function RecordThumb({
  src,
  alt,
  fallback,
  className,
}: {
  src?: string | null | undefined;
  alt: string;
  fallback?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        (fallback ?? alt.slice(0, 2).toUpperCase())
      )}
    </div>
  );
}
