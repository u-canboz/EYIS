import { paymentLabels } from "@/content/conversion";

/** Zahlarten-Zeile im Fuß. Beispielangaben im Testprojekt. */
export function PaymentBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-xs uppercase tracking-widest text-olive-foreground/60">
        Sicher bezahlen mit
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {paymentLabels.map((label) => (
          <li
            key={label}
            className="border border-olive-foreground/25 px-3 py-1.5 text-xs text-olive-foreground/85"
          >
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
