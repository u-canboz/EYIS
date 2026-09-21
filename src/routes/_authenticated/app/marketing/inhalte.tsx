import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  deleteSearchSynonym,
  deleteStorefrontBlock,
  deleteStorefrontPage,
  listStorefrontContent,
  saveSearchSynonym,
  saveStorefrontBlock,
  saveStorefrontPage,
  type SearchSynonym,
  type StorefrontBlock,
  type StorefrontPage,
} from "@/lib/commerce/storefront/content.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { RecordCard, RecordCardList } from "@/eyis/data/RecordCard";
import { EmptyState, ErrorState, ListSkeleton, PermissionState } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/marketing/inhalte")({
  head: () => ({
    meta: [
      { title: "Storefront-Inhalte – EYIS" },
      {
        name: "description",
        content:
          "Startseiten-Blöcke, Rechtstexte und Suchbegriffe deines Shops zentral pflegen.",
      },
      { property: "og:title", content: "Storefront-Inhalte – EYIS" },
      {
        property: "og:description",
        content: "Inhalte, Rechtstexte und Suchbegriffe für die Storefront.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StorefrontContentPage,
});

const emptyBlock = {
  id: null as string | null,
  section: "startseite",
  position: 0,
  title: "",
  subtitle: "",
  body: "",
  imageUrl: "",
  linkUrl: "",
  linkLabel: "",
  published: true,
};

const emptyPage = {
  id: null as string | null,
  handle: "",
  title: "",
  excerpt: "",
  body: "",
  published: true,
};

const emptySynonym = { id: null as string | null, term: "", synonyms: "" };

function StorefrontContentPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();
  const canManage = can("settings.manage");

  const [block, setBlock] = useState({ ...emptyBlock });
  const [page, setPage] = useState({ ...emptyPage });
  const [synonym, setSynonym] = useState({ ...emptySynonym });

  const fetchContent = useServerFn(listStorefrontContent);
  const runSaveBlock = useServerFn(saveStorefrontBlock);
  const runDeleteBlock = useServerFn(deleteStorefrontBlock);
  const runSavePage = useServerFn(saveStorefrontPage);
  const runDeletePage = useServerFn(deleteStorefrontPage);
  const runSaveSynonym = useServerFn(saveSearchSynonym);
  const runDeleteSynonym = useServerFn(deleteSearchSynonym);

  const contentQuery = useQuery({
    queryKey: ["storefront-content", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchContent({ data: { organizationId, shopId } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["storefront-content"] });
  const fail = (error: Error) => toast.error(error.message);

  const blockMutation = useMutation({
    mutationFn: () =>
      runSaveBlock({
        data: {
          organizationId,
          shopId,
          id: block.id,
          section: block.section,
          position: Number(block.position) || 0,
          title: block.title,
          subtitle: block.subtitle,
          body: block.body,
          imageUrl: block.imageUrl,
          linkUrl: block.linkUrl,
          linkLabel: block.linkLabel,
          published: block.published,
        },
      }),
    onSuccess: () => {
      toast.success("Block gespeichert.");
      setBlock({ ...emptyBlock });
      invalidate();
    },
    onError: fail,
  });

  const blockDelete = useMutation({
    mutationFn: (id: string) => runDeleteBlock({ data: { organizationId, id } }),
    onSuccess: () => {
      toast.success("Block gelöscht.");
      invalidate();
    },
    onError: fail,
  });

  const pageMutation = useMutation({
    mutationFn: () =>
      runSavePage({
        data: {
          organizationId,
          shopId,
          id: page.id,
          handle: page.handle,
          title: page.title,
          excerpt: page.excerpt,
          body: page.body,
          published: page.published,
        },
      }),
    onSuccess: () => {
      toast.success("Seite gespeichert.");
      setPage({ ...emptyPage });
      invalidate();
    },
    onError: fail,
  });

  const pageDelete = useMutation({
    mutationFn: (id: string) => runDeletePage({ data: { organizationId, id } }),
    onSuccess: () => {
      toast.success("Seite gelöscht.");
      invalidate();
    },
    onError: fail,
  });

  const synonymMutation = useMutation({
    mutationFn: () =>
      runSaveSynonym({
        data: {
          organizationId,
          shopId,
          id: synonym.id,
          term: synonym.term,
          synonyms: synonym.synonyms,
        },
      }),
    onSuccess: () => {
      toast.success("Suchbegriff gespeichert.");
      setSynonym({ ...emptySynonym });
      invalidate();
    },
    onError: fail,
  });

  const synonymDelete = useMutation({
    mutationFn: (id: string) => runDeleteSynonym({ data: { organizationId, id } }),
    onSuccess: () => {
      toast.success("Suchbegriff gelöscht.");
      invalidate();
    },
    onError: fail,
  });

  const editBlock = (row: StorefrontBlock) =>
    setBlock({
      id: row.id,
      section: row.section,
      position: row.position,
      title: row.title ?? "",
      subtitle: row.subtitle ?? "",
      body: row.body ?? "",
      imageUrl: row.image_url ?? "",
      linkUrl: row.link_url ?? "",
      linkLabel: row.link_label ?? "",
      published: row.published,
    });

  const editPage = (row: StorefrontPage) =>
    setPage({
      id: row.id,
      handle: row.handle,
      title: row.title,
      excerpt: row.excerpt ?? "",
      body: row.body,
      published: row.published,
    });

  const editSynonym = (row: SearchSynonym) =>
    setSynonym({ id: row.id, term: row.term, synonyms: row.synonyms.join(", ") });

  if (contentQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Storefront-Inhalte" />
        <ErrorState
          description={(contentQuery.error as Error).message}
          action={<Button onClick={() => contentQuery.refetch()}>Erneut laden</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storefront-Inhalte"
        description="Startseiten-Blöcke, Rechtstexte und Suchbegriffe. Veröffentlichte Einträge liest die Storefront direkt über die Store API."
      />

      {!canManage ? (
        <PermissionState what="das Ändern der Storefront-Inhalte" />
      ) : null}

      {contentQuery.isPending ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="grid gap-6">
          <Panel
            title="Startseiten-Blöcke"
            description="Ankündigungsband, Vertrauenspunkte, Hinweise und Textabschnitte."
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0">
                {contentQuery.data!.blocks.length === 0 ? (
                  <EmptyState
                    title="Noch keine Blöcke"
                    description="Lege rechts den ersten Inhaltsblock an."
                  />
                ) : (
                  <RecordCardList desktopHidden={false}>
                    {contentQuery.data!.blocks.map((row) => (
                      <RecordCard
                        key={row.id}
                        title={row.title || row.section}
                        subtitle={`${row.section} · Position ${row.position}`}
                        badges={
                          <Badge variant={row.published ? "default" : "secondary"}>
                            {row.published ? "Veröffentlicht" : "Entwurf"}
                          </Badge>
                        }
                        actions={
                          canManage ? (
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => editBlock(row)}>
                                Bearbeiten
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => blockDelete.mutate(row.id)}
                              >
                                Löschen
                              </Button>
                            </div>
                          ) : null
                        }
                        fields={row.body ? [{ label: "Text", value: row.body }] : undefined}
                      />
                    ))}
                  </RecordCardList>
                )}
              </div>

              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  blockMutation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="block-section">Bereich</Label>
                  <Input
                    id="block-section"
                    value={block.section}
                    onChange={(e) => setBlock({ ...block, section: e.target.value })}
                    placeholder="startseite"
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="block-position">Position</Label>
                  <Input
                    id="block-position"
                    type="number"
                    value={block.position}
                    onChange={(e) => setBlock({ ...block, position: Number(e.target.value) })}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="block-title">Überschrift</Label>
                  <Input
                    id="block-title"
                    value={block.title}
                    onChange={(e) => setBlock({ ...block, title: e.target.value })}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="block-subtitle">Unterzeile</Label>
                  <Input
                    id="block-subtitle"
                    value={block.subtitle}
                    onChange={(e) => setBlock({ ...block, subtitle: e.target.value })}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="block-body">Text</Label>
                  <Textarea
                    id="block-body"
                    rows={3}
                    value={block.body}
                    onChange={(e) => setBlock({ ...block, body: e.target.value })}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="block-image">Bildadresse</Label>
                  <Input
                    id="block-image"
                    value={block.imageUrl}
                    onChange={(e) => setBlock({ ...block, imageUrl: e.target.value })}
                    disabled={!canManage}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="block-link">Link</Label>
                    <Input
                      id="block-link"
                      value={block.linkUrl}
                      onChange={(e) => setBlock({ ...block, linkUrl: e.target.value })}
                      disabled={!canManage}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="block-link-label">Linktext</Label>
                    <Input
                      id="block-link-label"
                      value={block.linkLabel}
                      onChange={(e) => setBlock({ ...block, linkLabel: e.target.value })}
                      disabled={!canManage}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="block-published">Veröffentlicht</Label>
                  <Switch
                    id="block-published"
                    checked={block.published}
                    onCheckedChange={(v) => setBlock({ ...block, published: v })}
                    disabled={!canManage}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={!canManage || blockMutation.isPending}>
                    {block.id ? "Block aktualisieren" : "Block anlegen"}
                  </Button>
                  {block.id ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setBlock({ ...emptyBlock })}
                    >
                      Abbrechen
                    </Button>
                  ) : null}
                </div>
              </form>
            </div>
          </Panel>

          <Panel
            title="Rechtstexte und Inhaltsseiten"
            description="Impressum, AGB, Widerruf, Datenschutz und weitere Seiten."
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0">
                {contentQuery.data!.pages.length === 0 ? (
                  <EmptyState
                    title="Noch keine Seiten"
                    description="Lege rechts die erste Inhaltsseite an."
                  />
                ) : (
                  <RecordCardList desktopHidden={false}>
                    {contentQuery.data!.pages.map((row) => (
                      <RecordCard
                        key={row.id}
                        title={row.title}
                        subtitle={`/${row.handle}`}
                        badges={
                          <Badge variant={row.published ? "default" : "secondary"}>
                            {row.published ? "Veröffentlicht" : "Entwurf"}
                          </Badge>
                        }
                        actions={
                          canManage ? (
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => editPage(row)}>
                                Bearbeiten
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => pageDelete.mutate(row.id)}
                              >
                                Löschen
                              </Button>
                            </div>
                          ) : null
                        }
                        fields={row.excerpt ? [{ label: "Kurztext", value: row.excerpt }] : undefined}
                      />
                    ))}
                  </RecordCardList>
                )}
              </div>

              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  pageMutation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="page-title">Titel</Label>
                  <Input
                    id="page-title"
                    value={page.title}
                    onChange={(e) => setPage({ ...page, title: e.target.value })}
                    placeholder="Impressum"
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="page-handle">Adresse (optional)</Label>
                  <Input
                    id="page-handle"
                    value={page.handle}
                    onChange={(e) => setPage({ ...page, handle: e.target.value })}
                    placeholder="impressum"
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="page-excerpt">Kurzbeschreibung</Label>
                  <Input
                    id="page-excerpt"
                    value={page.excerpt}
                    onChange={(e) => setPage({ ...page, excerpt: e.target.value })}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="page-body">Text</Label>
                  <Textarea
                    id="page-body"
                    rows={8}
                    value={page.body}
                    onChange={(e) => setPage({ ...page, body: e.target.value })}
                    disabled={!canManage}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="page-published">Veröffentlicht</Label>
                  <Switch
                    id="page-published"
                    checked={page.published}
                    onCheckedChange={(v) => setPage({ ...page, published: v })}
                    disabled={!canManage}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={!canManage || pageMutation.isPending}>
                    {page.id ? "Seite aktualisieren" : "Seite anlegen"}
                  </Button>
                  {page.id ? (
                    <Button type="button" variant="ghost" onClick={() => setPage({ ...emptyPage })}>
                      Abbrechen
                    </Button>
                  ) : null}
                </div>
              </form>
            </div>
          </Panel>

          <Panel
            title="Suchbegriffe"
            description="Entsprechungen für die Shopsuche, zum Beispiel „oil“ für „Öl“."
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0">
                {contentQuery.data!.synonyms.length === 0 ? (
                  <EmptyState
                    title="Noch keine Suchbegriffe"
                    description="Lege rechts die erste Entsprechung an."
                  />
                ) : (
                  <RecordCardList desktopHidden={false}>
                    {contentQuery.data!.synonyms.map((row) => (
                      <RecordCard
                        key={row.id}
                        title={row.term}
                        subtitle={row.synonyms.join(", ")}
                        actions={
                          canManage ? (
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => editSynonym(row)}>
                                Bearbeiten
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => synonymDelete.mutate(row.id)}
                              >
                                Löschen
                              </Button>
                            </div>
                          ) : null
                        }
                      />
                    ))}
                  </RecordCardList>
                )}
              </div>

              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  synonymMutation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="synonym-term">Suchbegriff</Label>
                  <Input
                    id="synonym-term"
                    value={synonym.term}
                    onChange={(e) => setSynonym({ ...synonym, term: e.target.value })}
                    placeholder="oil"
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="synonym-values">Entsprechungen</Label>
                  <Textarea
                    id="synonym-values"
                    rows={3}
                    value={synonym.synonyms}
                    onChange={(e) => setSynonym({ ...synonym, synonyms: e.target.value })}
                    placeholder="öl, oel"
                    disabled={!canManage}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={!canManage || synonymMutation.isPending}>
                    {synonym.id ? "Begriff aktualisieren" : "Begriff anlegen"}
                  </Button>
                  {synonym.id ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSynonym({ ...emptySynonym })}
                    >
                      Abbrechen
                    </Button>
                  ) : null}
                </div>
              </form>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
