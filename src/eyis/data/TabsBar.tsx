import { cn } from "@/lib/utils";

export type TabItem = { value: string; label: string; count?: number | undefined };

/**
 * Compact, horizontally scrollable tab strip. Active tab is marked with the
 * functional orange accent and an underline — no pill wall.
 */
export function TabsBar({
  items,
  value,
  onChange,
  className,
  ariaLabel = "Ansicht",
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string | undefined;
  ariaLabel?: string | undefined;
}) {
  return (
    <div className={cn("scroll-x -mx-4 border-b border-border px-4 sm:mx-0 sm:px-0", className)}>
      <div role="tablist" aria-label={ariaLabel} className="flex min-w-max items-center gap-1">
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.value)}
              className={cn(
                "relative inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap transition-colors",
                active
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              {typeof item.count === "number" ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                    active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
