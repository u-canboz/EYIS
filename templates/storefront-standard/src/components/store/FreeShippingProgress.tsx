import { Truck } from "lucide-react";
import { FREE_SHIPPING_THRESHOLD_MINOR } from "@/content/conversion";
import { formatMoney } from "@/lib/storefront/money";

/**
 * Fortschritt bis zur versandkostenfreien Lieferung. Reine Anzeige — die
 * tatsächlichen Versandkosten berechnet weiterhin das Shopsystem in der Kasse.
 */
export function FreeShippingProgress({
  subtotalMinor,
  currencyCode,
  className = "",
}: {
  subtotalMinor: number;
  currencyCode: string;
  className?: string;
}) {
  const missing = Math.max(FREE_SHIPPING_THRESHOLD_MINOR - subtotalMinor, 0);
  const percent = Math.min(
    Math.round((subtotalMinor / FREE_SHIPPING_THRESHOLD_MINOR) * 100),
    100,
  );

  return (
    <div className={`min-w-0 ${className}`}>
      <p className="flex items-start gap-2 text-sm">
        <Truck className="mt-0.5 size-4 shrink-0 text-brass" aria-hidden />
        <span className="min-w-0">
          {missing === 0 ? (
            <span className="text-success">Versandkostenfrei — geschafft.</span>
          ) : (
            <>
              Nur noch{" "}
              <strong className="font-medium tabular-nums">
                {formatMoney(missing, currencyCode)}
              </strong>{" "}
              bis zum kostenfreien Versand.
            </>
          )}
        </span>
      </p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden bg-border"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Fortschritt bis versandkostenfrei"
      >
        <div
          className="h-full bg-brass transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
