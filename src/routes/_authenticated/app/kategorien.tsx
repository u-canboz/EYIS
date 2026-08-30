import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listTaxonomy,
  saveCategory,
  deleteCategory,
  saveCollection,
  deleteCollection,
} from "@/lib/commerce/taxonomy.functions";
import type { CategoryNode } from "@/lib/commerce/taxonomy.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { RecordCard, RecordCardList } from "@/eyis/data/RecordCard";
import { EmptyState, ErrorState, ListSkeleton } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/kategorien")({
  head: () => ({
    meta: [
      { title: "Kategorien & Kollektionen – EYIS" },
      {
        name: "description",
        content: "Kategoriebaum und Kollektionen deines Shops strukturieren und pflegen.",
      },
      { property: "og:title", content: "Kategorien & Kollektionen – EYIS" },
      { property: "og:description", content: "Struktur für deinen Produktkatalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TaxonomyPage,
});

function TaxonomyPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();

  const [categoryName, setCategoryName] = useState("");
  const [parentId, setParentId] = useState("root");
  const [collectionName, setCollectionName] = useState("");

  const fetchTaxonomy = useServerFn(listTaxonomy);
  const runSaveCategory = useServerFn(saveCategory);
  const runDeleteCategory = useServerFn(deleteCategory);
  const runSaveCollection = useServerFn(saveCollection);
  const runDeleteCollection = useServerFn(deleteCollection);

  const taxonomyQuery = useQuery({
    queryKey: ["taxonomy", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchTaxonomy({ data: { organizationId, shopId } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["taxonomy"] });

  const categoryMutation = useMutation({
    mutationFn: () =>
      runSaveCategory({
        data: {
          organizationId,
          shopId,
          name: categoryName,
          parentId: parentId === "root" ? null : parentId,
        },
      }),
    onSuccess: () => {
      toast.success("Kategorie gespeichert.");
      setCategoryName("");
      setParentId("root");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const categoryDeleteMutation = useMutation({
    mutationFn: (categoryId: string) => runDeleteCategory({ data: { organizationId, categoryId } }),
    onSuccess: () => {
      toast.success("Kategorie gelöscht.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const collectionMutation = useMutation({
    mutationFn: () => runSaveCollection({ data: { organizationId, shopId, name: collectionName } }),
    onSuccess: () => {
      toast.success("Kollektion gespeichert.");
      setCollectionName("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const collectionDeleteMutation = useMutation({
    mutationFn: (collectionId: string) =>
      runDeleteCollection({ data: { organizationId, collectionId } }),
    onSuccess: () => {
      toast.success("Kollektion gelöscht.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canManage = can("categories.manage");
  const canManageCollections = can("collections.manage");

  const renderTree = (nodes: CategoryNode[], depth = 0) =>
    nodes.map((node) => (
      <div key={node.id} className="min-w-0">
        <div
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-2 last:border-b-0"
          style={{ paddingLeft: depth * 20 }}
        >
          <div className="min-w-0">
            <span className="truncate text-sm font-medium">{node.name}</span>
            <span className="ml-2 truncate text-xs text-muted-foreground">/{node.handle}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary" className="tabular-nums">
              {node.product_count}
            </Badge>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={() => categoryDeleteMutation.mutate(node.id)}
              >
                Löschen
              </Button>
            )}
          </div>
        </div>
        {node.children.length > 0 && renderTree(node.children, depth + 1)}
      </div>
    ));

  const categories = taxonomyQuery.data?.categories ?? [];
  const collections = taxonomyQuery.data?.collections ?? [];

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Kategorien & Kollektionen"
        description="Kategorien bilden die Struktur, Kollektionen gruppieren Produkte frei."
      />

      <Panel title="Kategorien">
        {taxonomyQuery.isLoading ? (
          <ListSkeleton />
        ) : taxonomyQuery.error ? (
          <ErrorState description={(taxonomyQuery.error as Error).message} />
        ) : categories.length === 0 ? (
          <EmptyState title="Keine Kategorien" description="Noch keine Kategorien angelegt." />
        ) : (
          <div className="min-w-0">{renderTree(categories)}</div>
        )}

        {canManage && (
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
            <div>
              <Label>Neue Kategorie</Label>
              <Input
                className="mt-2 h-11"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
            </div>
            <div>
              <Label>Übergeordnet</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="mt-2 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Keine</SelectItem>
                  {(taxonomyQuery.data?.flatCategories ?? []).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="h-11"
              disabled={!categoryName.trim() || categoryMutation.isPending}
              onClick={() => categoryMutation.mutate()}
            >
              Hinzufügen
            </Button>
          </div>
        )}
      </Panel>

      <Panel title="Kollektionen">
        {taxonomyQuery.isLoading ? (
          <ListSkeleton />
        ) : collections.length === 0 ? (
          <EmptyState title="Keine Kollektionen" description="Noch keine Kollektionen angelegt." />
        ) : (
          <RecordCardList desktopHidden={false}>
            {collections.map((col) => (
              <RecordCard
                key={col.id}
                title={col.name}
                subtitle={`/${col.handle}`}
                trailing={
                  <Badge variant="secondary" className="tabular-nums">
                    {col.product_count}
                  </Badge>
                }
                actions={
                  canManageCollections && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11"
                      onClick={() => collectionDeleteMutation.mutate(col.id)}
                    >
                      Löschen
                    </Button>
                  )
                }
              />
            ))}
          </RecordCardList>
        )}

        {canManageCollections && (
          <div className="mt-6 flex flex-col items-end gap-3 sm:flex-row">
            <div className="w-full flex-1">
              <Label>Neue Kollektion</Label>
              <Input
                className="mt-2 h-11"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
              />
            </div>
            <Button
              className="h-11 w-full sm:w-auto"
              disabled={!collectionName.trim() || collectionMutation.isPending}
              onClick={() => collectionMutation.mutate()}
            >
              Hinzufügen
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
