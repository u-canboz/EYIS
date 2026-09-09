import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  deleteSearchSynonymFn,
  deleteStorefrontBlockFn,
  deleteStorefrontPageFn,
  listStorefrontContentFn,
  saveSearchSynonymFn,
  saveStorefrontBlockFn,
  saveStorefrontPageFn,
} from "@/lib/commerce/store/content.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { EmptyState, ListSkeleton } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/marketing/inhalte")({
  head: () => ({
    meta: [
      { title: "Storefront-Inhalte & Rechtstexte – EYIS" },
      {
        name: "description",
        content:
          "Startseiten-Blöcke, Rechtstexte wie Impressum und AGB sowie Suchbegriffe des Shops pflegen.",
      },
      { property: "og:title", content: "Storefront-Inhalte & Rechtstexte – EYIS" },
      {
        property: "og:description",
        content: "Inhalte der Storefront und Rechtstexte ohne Code ändern.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StorefrontContent,
});

type BlockDraft = {
  id?: string | null;
  section: string;
  position: number;
  title: string;
  subtitle: string;
  body: string;
  imageUrl: string;
  linkUrl: string;
  linkLabel: string;
  published: boolean;
};

const emptyBlock: BlockDraft = {
  section: "home",
  position: 0,
  title: "",
  subtitle: "",
  body: "",
  imageUrl: "",
  linkUrl: "",
  linkLabel: "",
  published: true,
};

type PageDraft = {
  id?: string | null;
  handle: string;
  title: string;
  excerpt: string;
  body: string;
  published: boolean;
};

const emptyPage: PageDraft = {
  handle: "",
  title: "",
  excerpt: "",
  body: "",
  published: false,
};

function StorefrontContent() {
  const { organizationId, shopId } = useActiveWorkspace();
  const qc = useQueryClient();
  const enabled = !!organizationId && !!shopId;

  const load = useServerFn(listStorefrontContentFn);
  const saveBlock = useServerFn(saveStorefrontBlockFn);
  const removeBlock = useServerFn(deleteStorefrontBlockFn);
  const savePage = useServerFn(saveStorefrontPageFn);
  const removePage = useServerFn(deleteStorefrontPageFn);
  const saveSynonym = useServerFn(saveSearchSynonymFn);
  const removeSynonym = useServerFn(deleteSearchSynonymFn);

  const content = useQuery({
    queryKey: ["storefront-content", organizationId, shopId],
    enabled,
    queryFn: () => load({ data: { organizationId, shopId } }),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["storefront-content"] });

  const [block, setBlock] = useState<BlockDraft>(emptyBlock);
  const [page, setPage] = useState<PageDraft>(emptyPage);
  const [term, setTerm] = useState("");
  const [synonyms, setSynonyms] = useState("");

  const blockMutation = useMutation({
    mutationFn: () =>
      saveBlock({
        data: {
          organizationId,
          shopId,
          id: block.id ?? null,
          section: block.section,
          position: Number(block.position) || 0,
          title: block.title || null,
          subtitle: block.subtitle || null,
          body: block.body || null,
          imageUrl: block.imageUrl || null,
          linkUrl: block.linkUrl || null,
          linkLabel: block.linkLabel || null,
          published: block.published,
        },
      }),
    onSuccess: () => {
      toast.success("Block gespeichert.");
      setBlock(emptyBlock);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pageMutation = useMutation({
    mutationFn: () =>
      savePage({
        data: {
          organizationId,
          shopId,
          id: page.id ?? null,
          handle: page.handle,
          title: page.title,
          excerpt: page.excerpt || null,
          body: page.body,
          published: page.published,
        },
      }),
    onSuccess: () => {
      toast.success("Seite gespeichert.");
      setPage(emptyPage);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const synonymMutation = useMutation({
    mutationFn: () =>
      saveSynonym({
        data: {
          organizationId,
          shopId,
          term,
          synonyms: synonyms
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success("Suchbegriff gespeichert.");
      setTerm("");
      setSynonyms("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (id: string) => removeBlock({ data: { organizationId, shopId, id } }),
    onSuccess: () => {
      toast.success("Block gelöscht.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePageMutation = useMutation({
    mutationFn: (id: string) => removePage({ data: { organizationId, shopId, id } }),
    onSuccess: () => {
      toast.success("Seite gelöscht.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSynonymMutation = useMutation({
    mutationFn: (id: string) => removeSynonym({ data: { organizationId, shopId, id } }),
    onSuccess: () => {
      toast.success("Suchbegriff gelöscht.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storefront-Inhalte"
        description="Startseiten-Blöcke, Rechtstexte und Suchbegriffe des Shops pflegen — ohne Code."
      />

      <Panel title="Startseiten-Block" description="Abschnitte der Storefront mit eigenem Inhalt.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="block-section">Abschnitt</Label>
            <Input
              id="block-section"
              value={block.section}
              onChange={(e) => setBlock({ ...block, section: e.target.value })}
              placeholder="home"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-position">Position</Label>
            <Input
              id="block-position"
              type="number"
              value={block.position}
              onChange={(e) => setBlock({ ...block, position: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-title">Überschrift</Label>
            <Input
              id="block-title"
              value={block.title}
              onChange={(e) => setBlock({ ...block, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-subtitle">Unterzeile</Label>
            <Input
              id="block-subtitle"
              value={block.subtitle}
              onChange={(e) => setBlock({ ...block, subtitle: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="block-body">Text</Label>
            <Textarea
              id="block-body"
              rows={4}
              value={block.body}
              onChange={(e) => setBlock({ ...block, body: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-image">Bildadresse</Label>
            <Input
              id="block-image"
              value={block.imageUrl}
              onChange={(e) => setBlock({ ...block, imageUrl: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-link">Linkziel</Label>
            <Input
              id="block-link"
              value={block.linkUrl}
              onChange={(e) => setBlock({ ...block, linkUrl: e.target.value })}
              placeholder="/kategorie/neuheiten"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-link-label">Linktext</Label>
            <Input
              id="block-link-label"
              value={block.linkLabel}
              onChange={(e) => setBlock({ ...block, linkLabel: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch
              id="block-published"
              checked={block.published}
              onCheckedChange={(v) => setBlock({ ...block, published: v })}
            />
            <Label htmlFor="block-published">Sichtbar</Label>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => blockMutation.mutate()} disabled={!enabled || blockMutation.isPending}>
            {block.id ? "Block aktualisieren" : "Block anlegen"}
          </Button>
          {block.id ? (
            <Button variant="ghost" onClick={() => setBlock(emptyBlock)}>
              Abbrechen
            </Button>
          ) : null}
        </div>
      </Panel>

      <Panel title="Vorhandene Blöcke">
        {content.isLoading ? (
          <ListSkeleton />
        ) : !content.data?.blocks.length ? (
          <EmptyState title="Noch keine Blöcke" description="Lege oben den ersten Block an." />
        ) : (
          <ul className="divide-y divide-border">
            {content.data.blocks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.title || b.section}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {b.section} · Position {b.position}
                  </p>
                </div>
                <Badge variant={b.published ? "default" : "secondary"}>
                  {b.published ? "Sichtbar" : "Versteckt"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setBlock({
                      id: b.id,
                      section: b.section,
                      position: b.position,
                      title: b.title ?? "",
                      subtitle: b.subtitle ?? "",
                      body: b.body ?? "",
                      imageUrl: b.imageUrl ?? "",
                      linkUrl: b.linkUrl ?? "",
                      linkLabel: b.linkLabel ?? "",
                      published: b.published,
                    })
                  }
                >
                  Bearbeiten
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteBlockMutation.mutate(b.id)}
                >
                  Löschen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Seite (Impressum, AGB, Datenschutz)"
        description="Rechtstexte und weitere Seiten der Storefront."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="page-handle">Kürzel</Label>
            <Input
              id="page-handle"
              value={page.handle}
              onChange={(e) => setPage({ ...page, handle: e.target.value })}
              placeholder="impressum"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-title">Titel</Label>
            <Input
              id="page-title"
              value={page.title}
              onChange={(e) => setPage({ ...page, title: e.target.value })}
              placeholder="Impressum"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="page-excerpt">Kurzbeschreibung</Label>
            <Input
              id="page-excerpt"
              value={page.excerpt}
              onChange={(e) => setPage({ ...page, excerpt: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="page-body">Inhalt</Label>
            <Textarea
              id="page-body"
              rows={10}
              value={page.body}
              onChange={(e) => setPage({ ...page, body: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="page-published"
              checked={page.published}
              onCheckedChange={(v) => setPage({ ...page, published: v })}
            />
            <Label htmlFor="page-published">Veröffentlicht</Label>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => pageMutation.mutate()} disabled={!enabled || pageMutation.isPending}>
            {page.id ? "Seite aktualisieren" : "Seite anlegen"}
          </Button>
          {page.id ? (
            <Button variant="ghost" onClick={() => setPage(emptyPage)}>
              Abbrechen
            </Button>
          ) : null}
        </div>
      </Panel>

      <Panel title="Vorhandene Seiten">
        {content.isLoading ? (
          <ListSkeleton />
        ) : !content.data?.pages.length ? (
          <EmptyState
            title="Noch keine Seiten"
            description="Impressum, AGB und Datenschutz gehören vor dem Livegang angelegt."
          />
        ) : (
          <ul className="divide-y divide-border">
            {content.data.pages.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="truncate text-sm text-muted-foreground">/{p.handle}</p>
                </div>
                <Badge variant={p.published ? "default" : "secondary"}>
                  {p.published ? "Veröffentlicht" : "Entwurf"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setPage({
                      id: p.id,
                      handle: p.handle,
                      title: p.title,
                      excerpt: p.excerpt ?? "",
                      body: p.body,
                      published: p.published,
                    })
                  }
                >
                  Bearbeiten
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deletePageMutation.mutate(p.id)}>
                  Löschen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Suchbegriffe"
        description="Alternativbegriffe, damit die Shopsuche auch umgangssprachliche Wörter findet."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="term">Begriff</Label>
            <Input
              id="term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="parfum"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="synonyms">Alternativbegriffe (mit Komma trennen)</Label>
            <Input
              id="synonyms"
              value={synonyms}
              onChange={(e) => setSynonyms(e.target.value)}
              placeholder="duft, eau de parfum"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button
            onClick={() => synonymMutation.mutate()}
            disabled={!enabled || synonymMutation.isPending}
          >
            Speichern
          </Button>
        </div>
        {content.data?.synonyms.length ? (
          <ul className="mt-4 divide-y divide-border">
            {content.data.synonyms.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.term}</p>
                  <p className="truncate text-sm text-muted-foreground">{s.synonyms.join(", ")}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTerm(s.term);
                    setSynonyms(s.synonyms.join(", "));
                  }}
                >
                  Bearbeiten
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteSynonymMutation.mutate(s.id)}
                >
                  Löschen
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </div>
  );
}
