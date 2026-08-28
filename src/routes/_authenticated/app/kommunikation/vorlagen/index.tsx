import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTemplatesFn } from "@/lib/commerce/communications/communication.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/PageHeader";
import { ScrollTabs } from "@/components/shell/DetailLayout";
import { RecordCard, RecordCardList } from "@/components/data/RecordCard";
import { TableScroll } from "@/components/data/TableScroll";
import { EmptyState, ListSkeleton } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/kommunikation/vorlagen/")({
  head: () => ({
    meta: [
      { title: "E-Mail-Vorlagen – EYIS" },
      {
        name: "description",
        content:
          "Alle transaktionalen E-Mail-Vorlagen für Bestellungen, Zahlungen, Versand, Dokumente und Retouren.",
      },
      { property: "og:title", content: "E-Mail-Vorlagen – EYIS" },
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
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Vorlagen"
        description="Systemvorlagen bleiben unverändert. Beim Bearbeiten entsteht eine eigene Fassung für diesen Shop."
        actions={
          <Button asChild variant="outline" size="sm" className="h-11">
            <Link to="/app/kommunikation">Zur Übersicht</Link>
          </Button>
        }
      />

      <ScrollTabs>
        {categories.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={category === c ? "default" : "outline"}
            className="min-h-11 shrink-0 rounded-full"
            onClick={() => setCategory(c)}
          >
            {c === "all" ? "Alle" : (CATEGORY_LABELS[c] ?? c)}
          </Button>
        ))}
      </ScrollTabs>

      {templates.isLoading ? (
        <ListSkeleton rows={3} />
      ) : !visible.length ? (
        <EmptyState title="Keine Vorlagen" description="Für diese Kategorie gibt es keine Vorlagen." />
      ) : (
        <>
          <RecordCardList>
            {visible.map((t) => (
              <Link
                key={t.id}
                to="/app/kommunikation/vorlagen/$templateId"
                params={{ templateId: t.id }}
                className="min-w-0"
              >
                <RecordCard
                  interactive
                  title={t.name}
                  subtitle={`${CATEGORY_LABELS[t.category] ?? t.category} · ${t.key}`}
                  badges={
                    <>
                      <Badge variant={t.isSystem ? "outline" : "secondary"}>
                        {t.isSystem ? "System" : "Eigene Fassung"}
                      </Badge>
                      <Badge variant={t.status === "active" ? "secondary" : "outline"}>
                        {t.status === "active" ? "Aktiv" : "Deaktiviert"}
                      </Badge>
                    </>
                  }
                  fields={
                    t.description ? [{ label: "Beschreibung", value: t.description }] : undefined
                  }
                />
              </Link>
            ))}
          </RecordCardList>

          <TableScroll desktopOnly>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Kategorie</th>
                  <th className="p-3 font-medium">Ereignisse</th>
                  <th className="p-3 font-medium">Herkunft</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/40">
                    <td className="max-w-[18rem] p-3">
                      <Link
                        to="/app/kommunikation/vorlagen/$templateId"
                        params={{ templateId: t.id }}
                        className="block truncate font-medium hover:underline"
                      >
                        {t.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">{t.key}</span>
                    </td>
                    <td className="p-3">{CATEGORY_LABELS[t.category] ?? t.category}</td>
                    <td className="max-w-[16rem] truncate p-3 text-xs text-muted-foreground">
                      {t.eventTypes.join(", ") || "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant={t.isSystem ? "outline" : "secondary"}>
                        {t.isSystem ? "System" : "Eigene Fassung"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={t.status === "active" ? "secondary" : "outline"}>
                        {t.status === "active" ? "Aktiv" : "Deaktiviert"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      )}
    </div>
  );
}
