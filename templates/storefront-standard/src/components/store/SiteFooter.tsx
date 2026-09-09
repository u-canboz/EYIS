import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { assets } from "@/assets/assets";
import { footerColumns, shop } from "@/content/shop";
import { PaymentBadges } from "./PaymentBadges";

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold tracking-wide">{children}</p>;
}

const linkClass =
  "inline-flex min-h-9 items-center text-sm text-olive-foreground/75 transition-colors hover:text-olive-foreground";

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-olive text-olive-foreground sm:mt-28">
      <div className="mx-auto grid max-w-(--content-max) gap-10 px-4 py-14 sm:px-6 md:grid-cols-3 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <img src={assets.logo} alt={shop.name} className="h-12 w-auto brightness-0 invert" />
          <p className="mt-4 flex items-start gap-2 text-sm text-olive-foreground/75">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{shop.addressLine}</span>
          </p>
        </div>

        <div className="min-w-0">
          <ColumnTitle>Sortiment</ColumnTitle>
          <ul className="mt-3 grid">
            {footerColumns.assortment.map((item) => (
              <li key={item.handle}>
                <Link to="/kategorie/$handle" params={{ handle: item.handle }} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <ColumnTitle>Kundenservice</ColumnTitle>
          <ul className="mt-3 grid">
            <li>
              <Link to="/versand" className={linkClass}>
                Versand
              </Link>
            </li>
            <li>
              <Link to="/kontakt" className={linkClass}>
                Kontakt
              </Link>
            </li>
            <li>
              <Link to="/konto" className={linkClass}>
                Mein Konto
              </Link>
            </li>
            <li>
              <Link to="/faq" className={linkClass}>
                FAQ
              </Link>
            </li>
            <li>
              <Link to="/retouren" className={linkClass}>
                Retoure anmelden
              </Link>
            </li>
          </ul>
        </div>

        <div className="min-w-0">
          <ColumnTitle>der Shop</ColumnTitle>
          <ul className="mt-3 grid">
            <li>
              <Link to="/ueber-uns" className={linkClass}>
                Über uns
              </Link>
            </li>
            <li>
              <Link to="/shop" className={linkClass}>
                Sortiment
              </Link>
            </li>
            <li>
              <Link to="/bestellung/gast" className={linkClass}>
                Bestellung verfolgen
              </Link>
            </li>
            <li>
              <a href={`mailto:${shop.email}`} className={linkClass}>
                {shop.email}
              </a>
            </li>
          </ul>
        </div>

        <div className="min-w-0">
          <ColumnTitle>Rechtliches</ColumnTitle>
          <ul className="mt-3 grid">
            <li>
              <Link to="/impressum" className={linkClass}>
                Impressum
              </Link>
            </li>
            <li>
              <Link to="/datenschutz" className={linkClass}>
                Datenschutz
              </Link>
            </li>
            <li>
              <Link to="/agb" className={linkClass}>
                AGB
              </Link>
            </li>
            <li>
              <Link to="/widerruf" className={linkClass}>
                Widerruf
              </Link>
            </li>
            <li>
              <Link to="/vertrag-widerrufen" className={linkClass}>
                Vertrag widerrufen
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-olive-foreground/15">
        <div className="mx-auto max-w-(--content-max) px-4 py-6 sm:px-6">
          <PaymentBadges />
        </div>
      </div>

      <div className="border-t border-olive-foreground/15">
        <div className="mx-auto flex max-w-(--content-max) flex-col gap-2 px-4 py-5 text-xs text-olive-foreground/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} {shop.name}. Alle Rechte vorbehalten.</span>
          <span>{shop.claim}</span>
        </div>
      </div>
    </footer>
  );
}
