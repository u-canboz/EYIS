import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lead metric: the single most important business number on a page. Larger
 * type, optional trend and sparkline. Used once, never as part of a tile grid.
 */
export function LeadMetric({
  label,
  value,
  caption,
  trendPercent,
  series,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode | undefined;
  trendPercent?: number | undefined;
  series?: number[] | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-3xl leading-none font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          {caption ? (
            <p className="mt-1.5 min-w-0 truncate text-xs text-muted-foreground">{caption}</p>
          ) : null}
        </div>
        {typeof trendPercent === "number" ? <Trend value={trendPercent} /> : null}
      </div>
      {series && series.length > 1 ? (
        <Sparkline values={series} className="mt-3 h-12 w-full" />
      ) : null}
    </div>
  );
}

/** Secondary metric, used in a two-column row beneath the lead metric. */
export function SubMetric({
  label,
  value,
  caption,
  to,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode | undefined;
  to?: string | undefined;
  className?: string | undefined;
}) {
  const body = (
    <>
      <p className="min-w-0 truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl leading-none font-semibold tabular-nums">{value}</p>
      {caption ? (
        <p className="mt-1 min-w-0 truncate text-xs text-muted-foreground">{caption}</p>
      ) : null}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cn("block min-w-0 rounded-lg py-0.5 hover:bg-muted/50", className)}>
        {body}
      </Link>
    );
  }
  return <div className={cn("min-w-0", className)}>{body}</div>;
}

export function Trend({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 text-sm font-medium tabular-nums",
        up ? "text-success" : "text-destructive",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {up ? "+" : ""}
      {value.toFixed(1).replace(".", ",")}%
    </span>
  );
}

/** Tiny decision-oriented trend chart — the only large visual on a dashboard. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = 100 / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => `${i * step},${30 - ((v - min) / span) * 28}`);
  const line = points.join(" ");
  const area = `0,30 ${line} 100,30`;

  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      role="img"
      aria-label="Trendverlauf"
      className={className}
    >
      <polygon points={area} className="fill-primary/10" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        className="text-primary"
      />
    </svg>
  );
}

/**
 * Compact attention list: operational problems bundled in one scannable block
 * instead of one card per number.
 */
export function AttentionList({
  items,
}: {
  items: {
    key: string;
    label: string;
    count: number;
    hint?: string | undefined;
    to: string;
    tone?: "critical" | "warn" | "neutral" | undefined;
  }[];
}) {
  return (
    <ul className="min-w-0 divide-y divide-border">
      {items.map((item) => {
        const alert = item.count > 0;
        return (
          <li key={item.key} className="min-w-0">
            <Link
              to={item.to}
              className="grid min-h-12 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2 hover:bg-muted/50"
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  !alert
                    ? "bg-border-strong"
                    : item.tone === "critical"
                      ? "bg-destructive"
                      : item.tone === "warn"
                        ? "bg-warning"
                        : "bg-primary",
                )}
              />
              <span className="min-w-0">
                <span className="block min-w-0 truncate text-sm">{item.label}</span>
                {item.hint ? (
                  <span className="block min-w-0 truncate text-xs text-muted-foreground">
                    {item.hint}
                  </span>
                ) : null}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    !alert && "text-muted-foreground",
                  )}
                >
                  {item.count}
                </span>
                <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Horizontal distribution bar — compact alternative to a donut chart. */
export function DistributionBar({
  segments,
}: {
  segments: { key: string; label: string; value: number; className: string }[];
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;
  return (
    <div className="min-w-0">
      <div className="flex h-2.5 min-w-0 overflow-hidden rounded-full bg-muted">
        {segments.map((s) =>
          s.value > 0 ? (
            <span
              key={s.key}
              className={s.className}
              style={{ width: `${(s.value / total) * 100}%` }}
              aria-hidden
            />
          ) : null,
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {segments.map((s) => (
          <li key={s.key} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", s.className)} />
            <span className="min-w-0 truncate text-xs text-muted-foreground">{s.label}</span>
            <span className="shrink-0 text-xs font-medium tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
