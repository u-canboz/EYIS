import { Mail, Package, RotateCcw, ShieldCheck } from "lucide-react";
import { trustPoints } from "@/content/shop";
import { Reveal } from "./Reveal";

const ICONS = {
  package: Package,
  shield: ShieldCheck,
  rotate: RotateCcw,
  mail: Mail,
} as const;

/** Breites Vertrauensband, z. B. direkt unter dem Hero. */
export function TrustBar() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto grid max-w-(--content-max) grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-4 lg:grid-cols-4 lg:py-12">
        {trustPoints.map((point, index) => {
          const Icon = ICONS[point.icon];
          return (
            <Reveal key={point.title} delay={index * 70}>
              <div className="flex min-w-0 gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-brass" strokeWidth={1.5} />
                <div className="min-w-0">
                  <p className="font-display text-base leading-snug">{point.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{point.text}</p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/** Kompakte Variante für Produktseite, Warenkorb und Kasse. */
export function TrustPoints({ className = "" }: { className?: string }) {
  return (
    <ul className={`grid gap-3 text-sm sm:grid-cols-2 ${className}`}>
      {trustPoints.map((point) => {
        const Icon = ICONS[point.icon];
        return (
          <li key={point.title} className="flex min-w-0 items-start gap-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-brass" strokeWidth={1.5} />
            <span className="min-w-0 text-muted-foreground">{point.title}</span>
          </li>
        );
      })}
    </ul>
  );
}
