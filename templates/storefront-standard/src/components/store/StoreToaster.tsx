/**
 * Storefront-Hinweise (Toasts) im Design der Vorlage.
 *
 * Ersetzt auf Kundenrouten den Standard-Look der Hinweis-Nachrichten:
 * warme Kartenfläche, feine Messing-Kontur, ruhige Oliv-Typografie.
 * Das Backoffice behält seinen eigenen, unveränderten Stil.
 */

import { Toaster as Sonner } from "sonner";

export function StoreToaster() {
  return (
    <Sonner
      position="top-right"
      className="storefront-toaster"
      gap={10}
      toastOptions={{
        classNames: {
          toast: "storefront-toast",
          title: "storefront-toast-title",
          description: "storefront-toast-description",
          icon: "storefront-toast-icon",
          closeButton: "storefront-toast-close",
          actionButton: "storefront-toast-action",
          cancelButton: "storefront-toast-cancel",
        },
      }}
    />
  );
}
