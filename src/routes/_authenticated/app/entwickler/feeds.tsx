import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  createProductFeedFn,
  listProductFeedsFn,
  rotateProductFeedTokenFn,
  updateProductFeedFn,
} from "@/lib/commerce/store/feed.functions";
import type { FeedFormat } from "@/lib/commerce/store/feed.server";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { EmptyState, ListSkeleton } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/entwickler/feeds")({
  head: () => ({
    meta: [
      { title: "Produktdatenfeed – Google Shopping – EYIS" },
      {
        name: "description",
        content:
          "Produktdatenfeed für Google Merchant Center erstellen, Feed-Adresse teilen und Zugang jederzeit widerrufen.",
      },
      { property: "og:title", content: "Produktdatenfeed – Google Shopping – EYIS" },
      {
        property: "og:description",
        content: "Täglich abrufbarer Produktfeed mit Preisen, Bildern und Lagerstatus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductFeeds,
});

function ProductFeeds() {
  const { organizationId, shopId } = useActiveWorkspace();
  const qc = useQueryClient();
  const enabled = !!organizationId && !!shopId;

  const [name, setName] = useState("Google Shopping");
  const [format, setFormat] = useState<FeedFormat>("google_shopping_xml");
  const [baseUrl, setBaseUrl] = useState("");
  const [brand, setBrand] = useState("");
  const [includeOutOfStock, setIncludeOutOfStock] = useState(true);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);

  const fetchFeeds = useServerFn(listProductFeedsFn);
  const createFeed = useServerFn(createProductFeedFn);
  const updateFeed = useServerFn(updateProductFeedFn);
  const rotateToken = useServerFn(rotateProductFeedTokenFn);

  const feeds = useQuery({
    queryKey: ["product-feeds", organizationId, shopId],
    enabled,
    queryFn: () => fetchFeeds({ data: { organizationId, shopId } }),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["product-feeds"] });
  const feedUrl = (token: string) =>
    `${typeof window === "undefined" ? "" : window.location.origin}/api/public/feeds/${token}`;

  const create = useMutation({
    mutationFn: () =>
      createFeed({
        data: {
          organizationId,
          shopId,
          name: name.trim() || "Google Shopping",
          format,
          baseUrl: baseUrl.trim() || null,
          defaultBrand: brand.trim() || null,
          includeOutOfStock,
        },
      }),
    onSuccess: (result) => {
      setFreshUrl(feedUrl(result.token));
      toast.success("Feed erstellt. Die Adresse wird genau einmal angezeigt.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rotate = useMutation({
    mutationFn: (feedId: string) => rotateToken({ data: { organizationId, feedId } }),
    onSuccess: (result) => {
      setFreshUrl(feedUrl(result.token));
      toast.success("Neue Adresse erzeugt. Die alte ist ab sofort ungültig.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (feedId: string) =>
      updateFeed({ data: { organizationId, feedId, status: "revoked" } }),
    onSuccess: () => {
      toast.success("Feed widerrufen.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Produktdatenfeed"
        description={
          <>
            Google Merchant Center lädt die Feed-Adresse täglich selbst ab. Der Feed enthält
            Produkte, Preise, Bilder und Lagerstatus des aktiven Shops. Die Adresse ist ein
            Geheimnis: Sie wird nur einmal angezeigt und kann jederzeit ersetzt oder widerrufen
            werden.
          </>
        }
        eyebrow={
          <>
            <Link
              to="/app/entwickler"
              className="min-h-11 items-center hover:text-foreground hover:underline"
            >
              API-Keys
            </Link>
            <Link
              to="/app/entwickler/api"
              className="min-h-11 items-center hover:text-foreground hover:underline"
            >
              API-Referenz
            </Link>
          </>
        }
      />

      {freshUrl ? (
        <Panel title="Feed-Adresse">
          <p className="text-sm text-muted-foreground">
            In Google Merchant Center unter „Feeds → Geplanter Abruf“ eintragen. Abrufintervall:
            täglich.
          </p>
          <code className="mt-3 block break-all rounded-md bg-muted p-3 font-mono text-xs">
            {freshUrl}
          </code>
          <div className="mt-3 flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(freshUrl);
                toast.success("Adresse kopiert.");
              }}
            >
              Kopieren
            </Button>
            <Button variant="ghost" onClick={() => setFreshUrl(null)}>
              Ausblenden
            </Button>
          </div>
        </Panel>
      ) : null}

      <Panel title="Neuen Feed anlegen">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="feed-name">Bezeichnung</Label>
            <Input id="feed-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feed-format">Format</Label>
            <select
              id="feed-format"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={format}
              onChange={(e) => setFormat(e.target.value as FeedFormat)}
            >
              <option value="google_shopping_xml">XML (RSS 2.0, empfohlen)</option>
              <option value="google_shopping_csv">CSV</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feed-base">Shop-Adresse für Produktlinks</Label>
            <Input
              id="feed-base"
              placeholder="https://shop.beispiel.de"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leer lassen, um die hinterlegte Shop-Domain zu verwenden.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feed-brand">Marke als Vorgabe</Label>
            <Input
              id="feed-brand"
              placeholder="Wird genutzt, wenn ein Produkt keine Marke hat"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border p-3">
          <div>
            <p className="text-sm font-medium">Nicht vorrätige Artikel mitliefern</p>
            <p className="text-xs text-muted-foreground">
              Google zeigt sie als „nicht auf Lager“ statt sie zu entfernen.
            </p>
          </div>
          <Switch checked={includeOutOfStock} onCheckedChange={setIncludeOutOfStock} />
        </div>
        <Button
          className="mt-4"
          disabled={!enabled || create.isPending}
          onClick={() => create.mutate()}
        >
          Feed erstellen
        </Button>
      </Panel>

      <Panel title="Vorhandene Feeds">
        {feeds.isLoading ? (
          <ListSkeleton />
        ) : !feeds.data?.length ? (
          <EmptyState title="Noch kein Feed" description="Lege oben den ersten Feed an." />
        ) : (
          <ul className="divide-y divide-border">
            {feeds.data.map((feed) => (
              <li key={feed.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{feed.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {feed.format === "google_shopping_csv" ? "CSV" : "XML"} · {feed.tokenPrefix}… ·{" "}
                    {feed.lastDownloadedAt
                      ? `zuletzt abgerufen ${new Date(feed.lastDownloadedAt).toLocaleString("de-DE")} (${feed.lastItemCount ?? 0} Artikel)`
                      : "noch nie abgerufen"}
                  </p>
                </div>
                <Badge variant={feed.status === "active" ? "default" : "secondary"}>
                  {feed.status === "active" ? "aktiv" : "widerrufen"}
                </Badge>
                {feed.status === "active" ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={rotate.isPending}
                      onClick={() => rotate.mutate(feed.id)}
                    >
                      Adresse ersetzen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(feed.id)}
                    >
                      Widerrufen
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
