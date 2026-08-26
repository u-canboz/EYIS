import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The only sanctioned horizontal scroll container for tables.
 * Hidden overflow is never used to mask layout problems — the scroll is explicit.
 */
export function TableScroll({
  children,
  className,
  /** Hide the table below `lg` when a card list is rendered instead. */
  desktopOnly,
}: {
  children: ReactNode;
  className?: string;
  desktopOnly?: boolean;
}) {
  return (
    <div
      className={cn(
        "scroll-x w-full rounded-xl border border-border bg-card",
        desktopOnly && "hidden lg:block",
        className,
      )}
    >
      {children}
    </div>
  );
}
