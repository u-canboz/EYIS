import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { categoryEntries } from "@/content/shop";

export function CategoryEntries() {
  return (
    <section className="mx-auto max-w-(--content-max) px-5 py-16 sm:px-8 sm:py-28">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">Unser Sortiment</p><h2 className="mt-3 font-display text-4xl sm:text-5xl">Ausgewählt für dich</h2></div>
        <Link to="/shop" className="hidden min-h-11 items-center text-sm underline underline-offset-4 sm:inline-flex">Alles entdecken</Link>
      </div>
      <div className="mt-9 grid grid-cols-2 gap-x-3 gap-y-8 sm:mt-12 sm:gap-x-8 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-4">
        {categoryEntries.map((entry, index) => (
          <Link
            key={entry.handle}
            to="/kategorie/$handle"
            params={{ handle: entry.handle }}
            className={`group block min-w-0 ${index === 1 || index === 3 ? "lg:mt-12" : ""}`}
          >
            <span className="block aspect-4/5 overflow-hidden bg-secondary sm:aspect-3/4"><img src={entry.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]" /></span>
            <span className="mt-3 flex items-center justify-between gap-2 font-display text-lg sm:mt-5 sm:text-xl">
              {entry.label}
              <ArrowRight className="size-4 shrink-0 text-brass transition-transform group-hover:translate-x-1" aria-hidden />
            </span>
            <span className="mt-1 hidden text-xs uppercase tracking-[0.14em] text-muted-foreground sm:block">Ausgewählt entdecken</span>
          </Link>
        ))}
      </div>
      <div className="mt-8 text-center sm:hidden">
        <Link to="/shop" className="text-sm underline underline-offset-4">
          Gesamtes Sortiment ansehen
        </Link>
      </div>
    </section>
  );
}
