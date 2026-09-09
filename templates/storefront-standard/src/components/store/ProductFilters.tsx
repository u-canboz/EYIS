import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StoreCategory, StoreCollection } from "@/lib/store-sdk";
import {
  activeFilterCount,
  emptyProductFilters,
  PRODUCT_SORTS,
  type ProductFilterState,
} from "@/lib/storefront/product-filters";

type Props = {
  categories: StoreCategory[];
  collections: StoreCollection[];
  activeCategory?: string | null;
  activeCollection?: string | null;
  filters: ProductFilterState;
  onChange: (next: ProductFilterState) => void;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-5 first:pt-0 last:border-b-0">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function FilterFields({
  categories,
  collections,
  activeCategory,
  activeCollection,
  filters,
  onChange,
}: Props) {
  const [min, setMin] = useState(filters.preis_min ? String(filters.preis_min) : "");
  const [max, setMax] = useState(filters.preis_max ? String(filters.preis_max) : "");

  useEffect(() => {
    setMin(filters.preis_min ? String(filters.preis_min) : "");
    setMax(filters.preis_max ? String(filters.preis_max) : "");
  }, [filters.preis_min, filters.preis_max]);

  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

  const applyPrice = () => {
    onChange({
      ...filters,
      preis_min: Math.max(0, Number(min) || 0),
      preis_max: Math.max(0, Number(max) || 0),
      seite: 1,
    });
  };

  const topLevel = sortedCategories.filter((c) => !c.parentId);
  const roots = topLevel.length > 0 ? topLevel : sortedCategories;
  const childrenOf = (id: string) => sortedCategories.filter((c) => c.parentId === id);

  return (
    <div>
      <Section title="Sortiment">
        <ul className="grid gap-0.5">
          <li>
            <Link
              to="/shop"
              className={`block px-2 py-2 text-sm transition-colors hover:bg-secondary ${!activeCategory && !activeCollection ? "bg-secondary font-semibold" : ""}`}
            >
              Alle Produkte
            </Link>
          </li>
          {roots.map((category) => {
            const children = childrenOf(category.id);
            const childActive = children.some((c) => c.handle === activeCategory);
            const expanded = childActive || activeCategory === category.handle;
            return (
              <li key={category.id}>
                <Link
                  to="/kategorie/$handle"
                  params={{ handle: category.handle }}
                  className={`block px-2 py-2 text-sm transition-colors hover:bg-secondary ${activeCategory === category.handle ? "bg-secondary font-semibold" : ""}`}
                >
                  {category.name}
                </Link>
                {children.length > 0 && expanded ? (
                  <ul className="mb-1 ml-3 grid gap-0.5 border-l border-border pl-2">
                    {children.map((child) => (
                      <li key={child.id}>
                        <Link
                          to="/kategorie/$handle"
                          params={{ handle: child.handle }}
                          className={`block px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${activeCategory === child.handle ? "bg-secondary font-semibold text-foreground" : ""}`}
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Section>


      {collections.length > 0 ? (
        <Section title="Kollektionen">
          <ul className="grid gap-1">
            {collections.map((collection) => (
              <li key={collection.id}>
                <Link
                  to="/kollektion/$handle"
                  params={{ handle: collection.handle }}
                  className={`block px-2 py-2 text-sm transition-colors hover:bg-secondary ${activeCollection === collection.handle ? "bg-secondary font-semibold" : ""}`}
                >
                  {collection.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Verfügbarkeit">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={filters.verfuegbar}
            onChange={(e) => onChange({ ...filters, verfuegbar: e.target.checked, seite: 1 })}
            className="size-4 accent-[var(--color-brass,currentColor)]"
          />
          Nur lieferbare Artikel
        </label>
      </Section>

      <Section title="Preis in Euro">
        <div className="flex items-center gap-2">
          <Input
            inputMode="numeric"
            value={min}
            onChange={(e) => setMin(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={applyPrice}
            placeholder="von"
            aria-label="Mindestpreis in Euro"
            className="h-11"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            inputMode="numeric"
            value={max}
            onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={applyPrice}
            placeholder="bis"
            aria-label="Höchstpreis in Euro"
            className="h-11"
          />
        </div>
        <Button variant="outline" className="mt-3 w-full" onClick={applyPrice}>
          Preis übernehmen
        </Button>
      </Section>

      <Section title="Sortierung">
        <select
          value={filters.sort}
          onChange={(e) => onChange({ ...filters, sort: e.target.value, seite: 1 })}
          aria-label="Sortierung"
          className="h-11 w-full border border-border bg-background px-3 text-sm"
        >
          {PRODUCT_SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Section>
    </div>
  );
}

/** Filterspalte auf großen Bildschirmen, Einschub auf Tablet und Handy. */
export function ProductFilters(props: Props) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(props.filters);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <aside className="hidden self-start lg:sticky lg:top-28 lg:block lg:max-h-[calc(100svh-9rem)] lg:overflow-y-auto lg:pr-2" aria-label="Filter">
        <FilterFields {...props} />
        {count > 0 ? (
          <Button
            variant="ghost"
            className="mt-4 w-full"
            onClick={() => props.onChange({ ...emptyProductFilters })}
          >
            Alle Filter zurücksetzen
          </Button>
        ) : null}
      </aside>

      <Button
        variant="outline"
        className="w-full sm:w-auto lg:hidden"
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filter{count > 0 ? ` (${count})` : ""}
      </Button>

      <div
        className={open ? "fixed inset-0 z-60 lg:hidden" : "pointer-events-none fixed inset-0 z-60 lg:hidden"}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Filter schließen"
          onClick={() => setOpen(false)}
          className={`absolute inset-0 h-full w-full bg-foreground/35 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          aria-label="Filter"
          className={`fixed inset-y-0 right-0 flex w-[min(92vw,22rem)] flex-col bg-background shadow-[var(--elevation-2)] transition-transform duration-400 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex min-h-16 items-center justify-between border-b border-border px-5">
            <h2 className="font-display text-xl">Filter</h2>
            <Button variant="ghost" size="icon" aria-label="Filter schließen" onClick={() => setOpen(false)}>
              <X />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <FilterFields {...props} />
          </div>
          <div className="grid gap-2 border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {count > 0 ? (
              <Button variant="ghost" onClick={() => props.onChange({ ...emptyProductFilters })}>
                Alle Filter zurücksetzen
              </Button>
            ) : null}
            <Button onClick={() => setOpen(false)}>Ergebnisse anzeigen</Button>
          </div>
        </aside>
      </div>
    </>
  );
}
