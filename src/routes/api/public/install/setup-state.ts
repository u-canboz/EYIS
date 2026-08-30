/**
 * Öffentlicher Einrichtungszustand einer Dedicated Installation (Dedicated V3).
 *
 * Liefert ausschließlich den groben Zustand, damit die öffentliche Anmeldeseite
 * den Erstinstallations-Hinweis zeigen kann. Niemals E-Mail-Adressen, niemals
 * Claim-Felder, niemals Tokens.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/install/setup-state")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getInstallation, claimState } = await import(
            "@/lib/commerce/system/installation.server"
          );
          const row = await getInstallation();
          const state = claimState(row);
          return Response.json({
            installed: row != null,
            claimState: state,
            ownerRegistrationRequired: state === "AWAITING_OWNER_REGISTRATION",
          });
        } catch {
          return Response.json({
            installed: false,
            claimState: "UNINITIALIZED",
            ownerRegistrationRequired: false,
          });
        }
      },
    },
  },
});
