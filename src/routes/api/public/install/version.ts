import { createFileRoute } from "@tanstack/react-router";
import release from "@/lib/eyis/installed-release.json";

/** Build identity, deliberately independent of the database's update journal. */
export const Route = createFileRoute("/api/public/install/version")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { version: release.version, artifactSha256: release.artifactSha256 },
          {
            headers: { "Cache-Control": "no-store, max-age=0" },
          },
        ),
    },
  },
});
