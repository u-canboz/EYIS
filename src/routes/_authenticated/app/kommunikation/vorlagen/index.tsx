import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTemplatesFn } from "@/lib/commerce/communications/communication.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/kommunikation/vorlagen/")({
  head: () => ({
    meta: [
      { title: "E-Mail-Vorlagen – Commerce OS" },
      {
        name: "description",
        content:
          "Alle transaktionalen E-Mail-Vorlagen für Bestellungen, Zahlungen, Versand, Dokumente und Retouren.",
      },
      { property: "og:title", content: "E-Mail-Vorlagen – Commerce OS" },
      { property: "og:description", content: "Vorlagen anpassen, veröffentlichen und testen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TemplatesPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  orders: "Bestellungen",
  payments: "Zahlungen",
  shipping: "Versand",
  documents: "Dokumente",
  returns: "Retouren",
  customer: "Kundenkonto",
};

function TemplatesPage() {
  const { organizationId, shopId } = useActiveWorkspace();
  const [category, setCategory] = useState<string>("all");
  const fetchTemplates = useServerFn(listTemplatesFn);

  const templates = useQuery({
    queryKey: ["communication-templates", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => fetchTemplates({ data: { organizationId, shopId } }),
  });

  const categories = ["all", ...new Set((templates.data ?? []).map((t) => t.category))];
  const visible = (templates.data ?? []).filter(
    (t) => category === "all" || t.category === category,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Vorlagen</h1>
          <p className="text-sm text-muted-foreground">
            Systemvorlagen bleiben unverändert. Beim Bearbeiten entsteht eine eigene Fassung für
            diesen Shop.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/kommunikation">Zur Übersicht</Link>
        </Button>
      </header>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              category === c ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {c === "all" ? "Alle" : (CATEGORY_LABELS[c] ?? c)}
          </button>
        ))}
      </div>

      {templates.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {visible.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link
                  to="/app/kommunikation/vorlagen/$templateId"
                  params={{ templateId: t.id }}
                  className="font-medium hover:underline"
                >
                  {t.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {CATEGORY_LABELS[t.category] ?? t.category} · {t.key}
                  {t.eventTypes.length ? ` · ${t.eventTypes.join(", ")}` : ""}
                </p>
                {t.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={t.isSystem ? "outline" : "secondary"}>
                  {t.isSystem ? "System" : "Eigene Fassung"}
                </Badge>
                <Badge variant={t.status === "active" ? "secondary" : "outline"}>
                  {t.status === "active" ? "Aktiv" : "Deaktiviert"}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
