import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Kontextleiste für Editoren mit ungespeicherten Änderungen.
 *
 * Muster aus gängigen Commerce-Backends (Shopify, Wix, Squarespace): solange
 * es Änderungen gibt, liegt eine ruhige Leiste am unteren Rand der Arbeitsfläche
 * mit genau zwei Wegen — verwerfen oder sichern. Kein Speichern-Knopf, der weit
 * oben aus dem Blick scrollt, und kein stiller Datenverlust beim Verlassen.
 *
 * Reine Präsentation: der Aufrufer entscheidet, was „geändert" bedeutet.
 */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  disabled,
  saveLabel = "Sichern",
  hint,
  className,
}: {
  dirty: boolean;
  saving?: boolean | undefined;
  onSave: () => void;
  onDiscard?: (() => void) | undefined;
  disabled?: boolean | undefined;
  saveLabel?: string | undefined;
  hint?: ReactNode | undefined;
  className?: string | undefined;
}) {
  // Tastaturkürzel: ⌘S / Strg+S sichert, ohne den Browserdialog zu öffnen.
  useEffect(() => {
    if (!dirty || disabled) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, disabled, onSave]);

  // Warnung beim Schließen des Tabs, solange Änderungen offen sind.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  if (!dirty) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-30 -mx-4 mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-y border-border bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border md:bottom-4",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">Nicht gesicherte Änderungen</p>
        {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onDiscard ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={saving}
            onClick={onDiscard}
          >
            Verwerfen
          </Button>
        ) : null}
        <Button type="button" className="min-h-11" disabled={disabled || saving} onClick={onSave}>
          {saving ? "Sichert…" : saveLabel}
        </Button>
      </div>
    </div>
  );
}
