import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Reference storefront presentation layer.
 *
 * Boundary: this file may only import React, the router, `@/components/ui/**`
 * and `@/lib/store-sdk/**`. No commerce internals, no Supabase.
 *
 * Visual direction: product first, quiet chrome, large imagery, one clear CTA.
 */

export const formatPrice = (minor: number, currency: string) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(
    minor / 100,
  );

/** Centered content column used by every storefront page. */
export function StoreContainer({
  children,
  className,
  wide,
}: {
  children: ReactNode;
  className?: string | undefined;
  wide?: boolean | undefined;
}) {
  return (
    <div
      className={cn("mx-auto w-full px-4 sm:px-6", wide ? "max-w-6xl" : "max-w-3xl", className)}
    >
      {children}
    </div>
  );
}

/** Section opener: small eyebrow, large headline. */
export function StoreHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string | undefined;
  title: string;
  description?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <header className={cn("min-w-0", className)}>
      {eyebrow ? (
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">{eyebrow}</p>
      ) : null}
      <h1 className="mt-1 font-display text-2xl leading-tight font-semibold tracking-tight wrap-anywhere text-balance sm:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-3 max-w-prose text-sm wrap-anywhere text-pretty text-muted-foreground sm:text-base">
          {description}
        </p>
      ) : null}
    </header>
  );
}

/** Square media frame that never collapses or overflows. */
export function ProductMedia({
  src,
  alt,
  className,
  priority,
}: {
  src?: string | null | undefined;
  alt: string;
  className?: string | undefined;
  priority?: boolean | undefined;
}) {
  return (
    <div className={cn("aspect-square w-full overflow-hidden rounded-2xl bg-muted", className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="grid size-full place-items-center text-xs text-muted-foreground">
          Kein Bild
        </div>
      )}
    </div>
  );
}

/** Product grid: two columns even on the narrowest phone, roomier on desktop. */
export function ProductGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-3">{children}</div>
  );
}

/** Sticky purchase bar for mobile product pages. */
export function StickyBuyBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t border-border bg-background/95 px-4 py-3 pb-safe backdrop-blur lg:hidden">
      {children}
    </div>
  );
}

/** Quiet notice used for empty and error states. */
export function StoreNotice({
  title,
  description,
  action,
  tone = "neutral",
}: {
  title: string;
  description?: ReactNode | undefined;
  action?: ReactNode | undefined;
  tone?: "neutral" | "error" | undefined;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-start gap-2 rounded-2xl border p-5",
        tone === "error" ? "border-destructive/30 bg-destructive/5" : "border-dashed border-border",
      )}
      role={tone === "error" ? "alert" : undefined}
    >
      <p className="font-medium text-pretty">{title}</p>
      {description ? (
        <p className="text-sm text-pretty text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
