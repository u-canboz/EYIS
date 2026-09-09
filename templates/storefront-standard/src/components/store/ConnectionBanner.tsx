import { useStorefrontConnection } from "./StorefrontProvider";

/** Sichtbarer Hinweis, solange der Shop noch nicht eingerichtet ist. */
export function ConnectionBanner() {
  const connection = useStorefrontConnection();
  if (connection.status === "connected") return null;

  return (
    <div className="bg-accent px-5 py-2 text-center text-xs text-accent-foreground">
      {connection.status === "setup_required"
        ? "Die Einrichtung des Shops im Backoffice ist noch nicht abgeschlossen."
        : "Der Shop ist gerade nicht erreichbar. Angezeigt werden Beispielinhalte."}
    </div>
  );
}
