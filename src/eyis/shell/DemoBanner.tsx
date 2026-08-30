import { FlaskConical } from "lucide-react";

/** Multi-line, wrapping demo notice. Never truncated, never clipped. */
export function DemoBanner() {
  return (
    <div
      role="status"
      data-demo-banner=""
      className="flex items-start gap-2 rounded-xl border border-signal/40 bg-signal/10 px-3 py-2 text-xs leading-relaxed text-foreground sm:text-sm"
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
      <p className="min-w-0 text-pretty">
        <span className="font-semibold">Demo-Umgebung</span> — synthetische Testdaten. Es entstehen
        keine echten Bestellungen, Zahlungen oder Versandaufträge.
      </p>
    </div>
  );
}
