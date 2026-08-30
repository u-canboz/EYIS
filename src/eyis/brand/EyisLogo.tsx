/**
 * EYIS Markenlogo. Rein präsentational: rendert ausschließlich die verbindlichen
 * Assets aus /brand/eyis. Keine Filter, Schatten oder Recoloring, immer
 * proportional skaliert (Höhe folgt automatisch aus der Breite).
 */
import { cn } from "@/lib/utils";

export type EyisLogoVariant = "full" | "wordmark" | "wordmark-claim" | "mark" | "app-icon";
export type EyisLogoTone = "default" | "white" | "monochrome";

const SOURCES: Record<EyisLogoVariant, Partial<Record<EyisLogoTone, string>>> = {
  full: {
    default: "/brand/eyis/eyis-full-logo.svg",
    white: "/brand/eyis/eyis-full-logo-white.svg",
    monochrome: "/brand/eyis/eyis-full-logo-monochrome.svg",
  },
  wordmark: {
    default: "/brand/eyis/eyis-wordmark.svg",
    white: "/brand/eyis/eyis-wordmark-white.svg",
  },
  "wordmark-claim": {
    default: "/brand/eyis/eyis-wordmark-with-claim.svg",
  },
  mark: {
    default: "/brand/eyis/eyis-mark.svg",
    white: "/brand/eyis/eyis-mark-white.svg",
  },
  "app-icon": {
    default: "/brand/eyis/eyis-app-icon.svg",
  },
};

interface EyisLogoProps {
  variant?: EyisLogoVariant;
  tone?: EyisLogoTone;
  /** Zielbreite in px. Höhe bleibt proportional. */
  width: number;
  /** true, wenn direkt daneben bereits „EYIS" als Text steht. */
  decorative?: boolean;
  className?: string;
}

export function EyisLogo({
  variant = "wordmark",
  tone = "default",
  width,
  decorative = false,
  className,
}: EyisLogoProps) {
  const src = SOURCES[variant][tone] ?? SOURCES[variant].default!;
  return (
    <img
      src={src}
      width={width}
      alt={decorative ? "" : "EYIS"}
      {...(decorative ? { "aria-hidden": true } : {})}
      className={cn("block h-auto w-auto max-w-full object-contain", className)}
      style={{ width }}
      draggable={false}
    />
  );
}
