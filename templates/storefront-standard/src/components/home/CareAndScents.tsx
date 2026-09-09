import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { careAndScents } from "@/content/shop";

function Tile({
  title,
  text,
  cta,
  handle,
  image,
  tone,
}: {
  title: string;
  text: string;
  cta: string;
  handle: string;
  image: string;
  tone: "light" | "dark";
}) {
  return (
    <article className="min-w-0">
      <img src={image} alt="" loading="lazy" className="aspect-4/3 w-full object-cover sm:aspect-16/10" />
      <div
        className={
          tone === "dark"
            ? "bg-olive p-5 text-olive-foreground sm:p-6"
            : "bg-surface p-5 text-surface-foreground sm:p-6"
        }
      >
        <h3 className="font-display text-xl">{title}</h3>
        <p className={tone === "dark" ? "mt-2 text-sm text-olive-foreground/80" : "mt-2 text-sm text-muted-foreground"}>
          {text}
        </p>
        <Link
          to="/kategorie/$handle"
          params={{ handle }}
          className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4"
        >
          {cta}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export function CareAndScents() {
  return (
    <section className="mx-auto max-w-(--content-max) px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-brass">Rituale für jeden Tag</p>
      <h2 className="mt-3 text-center font-display text-4xl">{careAndScents.title}</h2>
      <div className="mt-9 grid gap-5 sm:mt-10 sm:gap-6 md:grid-cols-2">
        <Tile {...careAndScents.care} tone="light" />
        <Tile {...careAndScents.scents} tone="dark" />
      </div>
    </section>
  );
}
