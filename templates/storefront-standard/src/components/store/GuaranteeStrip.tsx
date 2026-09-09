import { BadgeCheck } from "lucide-react";
import { guarantees } from "@/content/conversion";
import { Reveal } from "./Reveal";

/** Vier kurze Versprechen — beruhigt kurz vor dem Kaufabschluss. */
export function GuaranteeStrip() {
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto grid max-w-(--content-max) gap-8 px-4 py-14 sm:grid-cols-2 sm:px-6 md:grid-cols-4 lg:grid-cols-4">
        {guarantees.map((item, index) => (
          <Reveal key={item.title} delay={index * 70}>
            <div className="min-w-0">
              <BadgeCheck className="size-6 text-brass" strokeWidth={1.5} aria-hidden />
              <p className="mt-3 font-display text-lg leading-snug">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
