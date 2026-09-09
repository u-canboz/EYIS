import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  Headphones,
  Menu,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { useCart } from "@/lib/store-sdk/react/hooks";
import { assets } from "@/assets/assets";
import { mainNav, megaMenuGroups, shop } from "@/content/shop";
import { SearchPanel } from "./SearchPanel";
import { CartDrawer } from "./CartDrawer";
import { Button } from "@/components/ui/button";

const mobileMenuItems = megaMenuGroups.reduce<Array<{ label: string; handle: string }>>(
  (items, group) => [...items, ...group.items],
  [],
);

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(true);
  const [term, setTerm] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const { data: cart } = useCart();
  const count = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!searchRef.current?.contains(target) && !mobileSearchRef.current?.contains(target)) setPanelOpen(false);
      if (!headerRef.current?.contains(target)) setMegaOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  useEffect(() => {
    if (!menuOpen && !cartOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setCartOpen(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen, cartOpen]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMegaOpen(false);
        setPanelOpen(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = term.trim();
    if (q.length < 2) return;
    setPanelOpen(false);
    setMenuOpen(false);
    void navigate({ to: "/suche", search: { q } });
  };

  const closeNavigation = () => {
    setMegaOpen(false);
    setMenuOpen(false);
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-[4.5rem] w-full max-w-(--content-max) items-center gap-2 px-4 sm:h-20 sm:gap-3 sm:px-6 lg:gap-8">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Menü öffnen"
          aria-expanded={menuOpen}
          className="-ml-2 size-11 shrink-0 lg:hidden"
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="size-5" />
        </Button>

        <Link to="/" className="flex min-w-0 shrink-0 items-center justify-center lg:justify-start" aria-label={`${shop.name} Startseite`}>
          <img src={assets.logo} alt={shop.name} className="h-9 w-auto sm:h-11" />
        </Link>

        <div ref={searchRef} className="relative hidden min-w-0 max-w-2xl flex-1 md:block lg:order-none">

          <form onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)_3rem]">
            <label className="sr-only" htmlFor="site-search">Produkte suchen</label>
            <input
              id="site-search"
              value={term}
              onChange={(event) => { setTerm(event.target.value); setPanelOpen(true); }}
              onFocus={() => setPanelOpen(true)}
              placeholder="Produkte suchen"
              autoComplete="off"
              className="h-12 min-w-0 border border-r-0 border-border bg-card px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-brass"
            />
            <Button type="submit" size="icon" className="size-12 rounded-l-none" aria-label="Suchen">
              <Search className="size-4" />
            </Button>
          </form>
          {panelOpen ? <SearchPanel term={term} onClose={() => setPanelOpen(false)} /> : null}
        </div>

        <div className="ml-auto flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          <Button asChild variant="ghost" className="hidden min-h-11 gap-2 px-3 md:inline-flex">
            <Link to="/konto"><User className="size-4" aria-hidden /><span>Konto</span></Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCartOpen(true)}
            aria-label={`Warenkorb öffnen, ${count} Artikel`}
            className="relative min-h-11 gap-2 px-2 sm:px-3"
          >
            <ShoppingBag className="size-5" aria-hidden />
            <span className="hidden sm:inline">Warenkorb</span>
            <span className="flex min-w-5 items-center justify-center rounded-full bg-brass px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary-foreground">{count}</span>
          </Button>
        </div>
      </div>

      <div ref={mobileSearchRef} className="relative border-t border-border px-4 py-2.5 md:hidden">
        <form onSubmit={submit} className="mx-auto grid max-w-(--content-max) grid-cols-[minmax(0,1fr)_2.75rem]">
          <label className="sr-only" htmlFor="mobile-site-search">Produkte suchen</label>
          <input
            id="mobile-site-search"
            value={term}
            onChange={(event) => { setTerm(event.target.value); setPanelOpen(true); }}
            onFocus={() => setPanelOpen(true)}
            placeholder="Produkte suchen …"
            autoComplete="off"
            className="h-11 min-w-0 border border-r-0 border-border bg-card px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-brass"
          />
          <Button type="submit" size="icon" className="size-11 rounded-l-none" aria-label="Suchen"><Search className="size-4" /></Button>
        </form>
        {panelOpen ? <SearchPanel term={term} onClose={() => setPanelOpen(false)} /> : null}
      </div>

      <nav className="relative hidden border-t border-border lg:block" aria-label="Hauptnavigation">
        <div className="mx-auto flex h-13 max-w-(--content-max) items-stretch px-6">
          <Button
            variant="ghost"
            className={`h-full rounded-none border-x border-border px-5 font-semibold ${megaOpen ? "bg-secondary text-foreground" : ""}`}
            aria-expanded={megaOpen}
            aria-controls="store-mega-menu"
            onClick={() => setMegaOpen((value) => !value)}
          >
            Sortiment <ChevronDown className={`size-4 transition-transform ${megaOpen ? "rotate-180" : ""}`} />
          </Button>
          <ul className="flex min-w-0 items-stretch">
            {mainNav.slice(0, 4).map((item) => (
              <li key={item.handle} className="flex">
                <Link
                  to="/kategorie/$handle"
                  params={{ handle: item.handle }}
                  className="flex items-center px-4 text-sm text-foreground/75 transition-colors hover:bg-secondary hover:text-foreground xl:px-5"
                  activeProps={{ className: "bg-secondary text-foreground" }}
                  onClick={() => setMegaOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/shop" className="ml-auto flex shrink-0 items-center gap-2 px-4 text-sm font-semibold transition-colors hover:text-brass">
            Alle Produkte <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>

        <div
          id="store-mega-menu"
          className={`absolute inset-x-0 top-full border-y border-border bg-background shadow-[var(--elevation-2)] transition-[opacity,transform,visibility] duration-300 ${megaOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"}`}
        >
          <div className="mx-auto grid max-w-(--content-max) grid-cols-[minmax(0,1fr)_18rem] gap-8 px-6 py-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="grid grid-cols-4 gap-6">
              {megaMenuGroups.map((group) => (
                <section key={group.title} className="min-w-0">
                  <h2 className="font-display text-xl">{group.title}</h2>
                  <p className="mt-1 min-h-10 text-xs leading-relaxed text-muted-foreground">{group.description}</p>
                  <ul className="mt-4 grid gap-1">
                    {group.items.map((item) => (
                      <li key={item.handle}>
                        <Link
                          to="/kategorie/$handle"
                          params={{ handle: item.handle }}
                          onClick={closeNavigation}
                          className="group flex min-h-10 items-center justify-between gap-2 border-b border-border/60 text-sm transition-colors hover:text-brass"
                        >
                          <span>{item.label}</span><ChevronRight className="size-3.5 shrink-0 opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <Link to="/shop" onClick={closeNavigation} className="group relative min-h-56 overflow-hidden bg-olive">
              <img src={assets.categoryTwo} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75 transition-transform duration-700 group-hover:scale-105" />
              <span className="absolute inset-0 bg-olive/45" aria-hidden />
              <span className="absolute inset-x-0 bottom-0 p-5 text-olive-foreground">
                <span className="block text-xs font-semibold uppercase">Aus dem Sortiment</span>
                <span className="mt-1 block font-display text-2xl">Alles entdecken</span>
                <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">Entdecken <ChevronRight className="size-4" /></span>
              </span>
            </Link>
          </div>
          <div className="border-t border-border bg-surface">
            <div className="mx-auto flex h-12 max-w-(--content-max) items-center gap-6 px-6 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{shop.name}</span>
              <Link to="/ueber-uns" onClick={closeNavigation} className="hover:text-foreground">Über uns</Link>
              <Link to="/versand" onClick={closeNavigation} className="hover:text-foreground">Versand</Link>
              <Link to="/faq" onClick={closeNavigation} className="hover:text-foreground">FAQ</Link>
              <Link to="/kontakt" onClick={closeNavigation} className="ml-auto hover:text-foreground">Persönliche Beratung</Link>
            </div>
          </div>
        </div>
      </nav>

      <div className={menuOpen ? "fixed inset-0 z-50 overflow-hidden lg:hidden" : "pointer-events-none fixed inset-0 z-50 overflow-hidden lg:hidden"} aria-hidden={!menuOpen}>
        <Button variant="ghost" aria-label="Menü schließen" onClick={() => setMenuOpen(false)} className={`absolute inset-0 h-full w-full rounded-none bg-foreground/40 transition-opacity duration-300 hover:bg-foreground/40 ${menuOpen ? "opacity-100" : "opacity-0"}`} />
        <aside aria-label="Shop-Menü" className={`absolute left-0 top-0 flex h-full w-[min(92vw,26rem)] flex-col bg-background shadow-[var(--elevation-2)] transition-transform duration-500 ease-out ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border px-5">
            <Link to="/" onClick={closeNavigation} className="min-w-0"><img src={assets.logo} alt={shop.name} className="h-10 w-auto" /></Link>
            <Button variant="ghost" size="icon" className="size-11" onClick={() => setMenuOpen(false)} aria-label="Menü schließen"><X /></Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="border-b border-border p-5">
              <form onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)_2.75rem]">
                <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Produkte suchen" aria-label="Produkte suchen" className="h-11 min-w-0 border border-r-0 border-border bg-card px-4 text-sm outline-none focus:border-brass" />
                <Button type="submit" size="icon" className="size-11 rounded-l-none" aria-label="Suchen"><Search className="size-4" /></Button>
              </form>
            </div>
            <div className="px-5 py-4">
              <Link to="/shop" onClick={closeNavigation} className="flex min-h-12 items-center justify-between border-b border-border font-display text-xl">
                Gesamtes Sortiment <ChevronRight className="size-4 text-brass" />
              </Link>
              <Button variant="ghost" onClick={() => setMobileCategoriesOpen((value) => !value)} aria-expanded={mobileCategoriesOpen} className="flex min-h-12 w-full justify-between rounded-none border-b border-border px-0 font-display text-xl font-normal">
                Kategorien <ChevronDown className={`size-4 transition-transform ${mobileCategoriesOpen ? "rotate-180" : ""}`} />
              </Button>
              {mobileCategoriesOpen ? (
                <div className="grid grid-cols-2 gap-x-5 py-3">
                  {mobileMenuItems.map((item) => (
                    <Link key={item.handle} to="/kategorie/$handle" params={{ handle: item.handle }} onClick={closeNavigation} className="flex min-h-11 min-w-0 items-center border-b border-border/60 text-sm">
                      <span className="min-w-0 break-words">{item.label}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 grid gap-1">
                <Link to="/konto" onClick={closeNavigation} className="flex min-h-12 items-center gap-3 text-sm font-semibold"><User className="size-4 text-brass" />Mein Konto</Link>
                <Link to="/kontakt" onClick={closeNavigation} className="flex min-h-12 items-center gap-3 text-sm font-semibold"><Headphones className="size-4 text-brass" />Kontakt & Beratung</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-border bg-surface px-5 py-4 pb-safe">
            <p className="font-display text-lg">{shop.claim}</p>
            <p className="mt-1 text-xs text-muted-foreground">{shop.addressLine}</p>
          </div>
        </aside>
      </div>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </header>
  );
}